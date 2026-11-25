"use client";

import {
  ArchiveRestore, ArrowDownLeft, ArrowUpRight, Bell, CalendarDays, Camera, Check, ChevronDown, CircleDollarSign,
  ClipboardList, Download, Heart, Home, House, ImagePlus, MessageCircle, MoreHorizontal, Pencil, Plus,
  Send, Settings2, ShieldCheck, ShoppingBag, Sparkles, Trash2, TrendingDown, TrendingUp, Wallet,
} from "lucide-react";
import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";

type View = "home" | "transactions" | "wedding" | "housing" | "chat" | "activity" | "household" | "trash";
type Entry = {
  id: string; type: "INCOME" | "EXPENSE"; amount: string | number; category: string;
  date: string; note: string | null; paymentMethod: string | null;
  author: { id: string; name: string | null }; owner: { id: string; name: string | null } | null;
};
type Category = { id: string; name: string; monthlyCap: string | number | null; color: string };
type Review = { id: string; userId: string; opinion: "LIKE" | "MAYBE" | "DISLIKE"; score: number | null; comment: string | null; author: { id: string; name: string | null } };
type Item = {
  id: string; title: string; category: string; estimatedAmount: string | number | null; actualAmount: string | number | null;
  depositAmount: string | number | null; url: string | null; storeName: string | null; status: string; priority: string;
  dueDate: string | null; note: string | null; reviews: Review[]; photos: { id: string; filename: string }[];
};
type HousingOption = {
  id: string; name: string; rent: string | number; charges: string | number | null; deposit: string | number | null;
  areaM2: string | number | null; neighborhood: string | null; address: string | null; notes: string | null;
  pros: string | null; cons: string | null; visitDate: string | null; photos: { id: string; filename: string }[];
};
type Household = {
  id: string; name: string; currencyCode: string;
  members: { id: string; userId: string; role: string; user: { id: string; name: string | null; email: string } }[];
};
type Activity = { id: string; action: string; entityType: string; before: unknown; after: unknown; createdAt: string; actor: { name: string | null; email: string } };
type ChatMessage = { id: string; itemId: string | null; body: string; imageUrl: string | null; createdAt: string; author: { id: string; name: string | null } };

const navItems: { key: View; label: string; icon: typeof Home }[] = [
  { key: "home", label: "Vue d’ensemble", icon: Home },
  { key: "transactions", label: "Opérations", icon: Wallet },
  { key: "wedding", label: "Mariage & achats", icon: Heart },
  { key: "housing", label: "Logement", icon: House },
  { key: "chat", label: "Discussion", icon: MessageCircle },
  { key: "activity", label: "Historique", icon: ClipboardList },
  { key: "household", label: "Notre foyer", icon: Settings2 },
  { key: "trash", label: "Corbeille", icon: ArchiveRestore },
];
const opinionLabel = { LIKE: "J’aime", MAYBE: "Bof", DISLIKE: "Non" };
const statusLabel: Record<string, string> = { IDEA: "Idée", COMPARING: "En comparaison", DECIDED: "Décidé", PURCHASED: "Acheté", PAID: "Payé" };
const currencyNames: Record<string, string> = { TND: "DT", EUR: "€", USD: "$" };

function amount(value: string | number | null | undefined) {
  const numeric = Number(value || 0);
  return new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(numeric);
}
function formatCurrency(value: string | number | null | undefined, currency = "TND") {
  return `${amount(value)} ${currencyNames[currency] || currency}`;
}
function dateLabel(date: string | Date) {
  return new Intl.DateTimeFormat("fr-TN", { day: "numeric", month: "short" }).format(new Date(date));
}
function initials(name: string | null | undefined) {
  return (name || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}
function monthStart(offset = 0) {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}
function monthName(date: Date, short = false) {
  return new Intl.DateTimeFormat("fr-TN", { month: short ? "short" : "long" }).format(date);
}

async function compressPhoto(file: File) {
  if (!file.type.startsWith("image/") || file.type === "image/heic" || file.size <= 700 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    let result = file;
    if (context) {
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const compressed = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
      if (compressed) result = new File([compressed], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
    }
    bitmap.close();
    return result;
  } catch {
    if (file.size > 4 * 1024 * 1024) throw new Error("Cette image ne peut pas être compressée sur cet appareil.");
    return file;
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Une erreur est survenue.");
  return body as T;
}

function Brand() {
  return <div className="brand"><span className="brand-mark">∞</span><div><div className="brand-name">DeuxNous</div><div className="brand-sub">Budget & préparatifs</div></div></div>;
}

export function AppShell({ userId, userName }: { userId: string; userName: string }) {
  const [view, setView] = useState<View>("home");
  const [household, setHousehold] = useState<Household | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [housing, setHousing] = useState<HousingOption[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatPhoto, setChatPhoto] = useState<File | null>(null);
  const [unread, setUnread] = useState(0);
  const [inviteUrl, setInviteUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [showItemForm, setShowItemForm] = useState(false);
  const [showHousingForm, setShowHousingForm] = useState(false);
  const [decisionOnly, setDecisionOnly] = useState(false);
  const [activeChatItem, setActiveChatItem] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [trashEntries, setTrashEntries] = useState<{ id: string; type: "transaction" | "weddingItem" | "housingOption"; title: string; deletedAt: string | null }[]>([]);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, string>>({});
  const [reviewScores, setReviewScores] = useState<Record<string, string>>({});
  const [inviteEmail, setInviteEmail] = useState("");
  const [householdName, setHouseholdName] = useState("");
  const [currencyCode, setCurrencyCode] = useState("TND");
  const [categoryName, setCategoryName] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  async function logout() {
    await authClient.signOut();
    window.location.replace("/connexion");
  }

  useEffect(() => {
    if (!mobileMoreOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMoreOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileMoreOpen]);

  const refreshAll = useCallback(async () => {
    try {
      const [householdResult, transactionResult, categoryResult, itemResult, housingResult, activityResult, unreadResult] = await Promise.all([
        requestJson<{ household: Household; invite: { token: string } | null }>("/api/household"),
        requestJson<{ entries: Entry[] }>("/api/transactions"),
        requestJson<{ categories: Category[] }>("/api/categories"),
        requestJson<{ items: Item[] }>("/api/items"),
        requestJson<{ options: HousingOption[] }>("/api/housing"),
        requestJson<{ activities: Activity[] }>("/api/activity"),
        requestJson<{ count: number }>("/api/messages/unread"),
      ]);
      setHousehold(householdResult.household);
      setHouseholdName(householdResult.household.name);
      setCurrencyCode(householdResult.household.currencyCode);
      setEntries(transactionResult.entries);
      setCategories(categoryResult.categories);
      setItems(itemResult.items);
      setHousing(housingResult.options);
      setActivities(activityResult.activities);
      setUnread(unreadResult.count);
      if (householdResult.invite) setInviteUrl(`${window.location.origin}/inscription?invitation=${householdResult.invite.token}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de charger votre foyer.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial data is loaded asynchronously after the authenticated shell mounts.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refreshAll(); }, [refreshAll]);

  const loadTrash = useCallback(async () => {
    try {
      const result = await requestJson<{
        transactions: { id: string; category: string; note: string | null; deletedAt: string | null }[];
        items: { id: string; title: string; deletedAt: string | null }[];
        housing: { id: string; name: string; deletedAt: string | null }[];
      }>("/api/trash");
      setTrashEntries([
        ...result.transactions.map((entry) => ({ id: entry.id, type: "transaction" as const, title: entry.note || entry.category, deletedAt: entry.deletedAt })),
        ...result.items.map((item) => ({ id: item.id, type: "weddingItem" as const, title: item.title, deletedAt: item.deletedAt })),
        ...result.housing.map((option) => ({ id: option.id, type: "housingOption" as const, title: option.name, deletedAt: option.deletedAt })),
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de charger la corbeille.");
    }
  }, []);

  // Refresh only when the user opens the trash screen.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (view === "trash") void loadTrash(); }, [view, loadTrash]);

  const loadMessages = useCallback(async () => {
    const query = activeChatItem ? `?itemId=${encodeURIComponent(activeChatItem)}` : "";
    try {
      const result = await requestJson<{ messages: ChatMessage[] }>(`/api/messages${query}`);
      setMessages(result.messages);
      const unreadResult = await requestJson<{ count: number }>("/api/messages/unread");
      setUnread(unreadResult.count);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de charger la discussion.");
    }
  }, [activeChatItem]);

  useEffect(() => {
    if (view !== "chat") return;
    // Poll while the private chat is visible; no persistent WebSocket is required on Vercel.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMessages();
    const timer = window.setInterval(() => void loadMessages(), 12000);
    return () => window.clearInterval(timer);
  }, [view, loadMessages]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const currentMonthEntries = useMemo(() => entries.filter((entry) => {
    const date = new Date(entry.date);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }), [entries]);
  const monthlyIncome = currentMonthEntries.filter((entry) => entry.type === "INCOME").reduce((sum, entry) => sum + Number(entry.amount), 0);
  const monthlyExpense = currentMonthEntries.filter((entry) => entry.type === "EXPENSE").reduce((sum, entry) => sum + Number(entry.amount), 0);
  const weddingEstimated = items.reduce((sum, item) => sum + Number(item.estimatedAmount || 0), 0);
  const weddingActual = items.reduce((sum, item) => sum + Number(item.actualAmount || 0), 0);
  const remainingWedding = items.reduce((sum, item) => sum + Math.max(0, Number(item.actualAmount || item.estimatedAmount || 0) - Number(item.depositAmount || 0)), 0);
  const coupleMembers = household?.members || [];

  async function runAction(action: () => Promise<void>, successText?: string) {
    setError("");
    setSuccess("");
    try {
      await action();
      if (successText) setSuccess(successText);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Cette action n’a pas abouti.");
    }
  }

  async function submitTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await runAction(async () => {
      await requestJson(editingEntry ? `/api/transactions/${editingEntry.id}` : "/api/transactions", {
        method: editingEntry ? "PATCH" : "POST",
        body: JSON.stringify({
          type: data.get("type"),
          amount: data.get("amount"),
          ownerId: data.get("ownerId") || null,
          category: data.get("category") || data.get("customCategory"),
          ...(!editingEntry && data.get("frequency") ? { frequency: data.get("frequency") } : {}),
          note: data.get("note"),
          paymentMethod: data.get("paymentMethod"),
          date: new Date(`${data.get("date")}T12:00:00`).toISOString(),
        }),
      });
      form.reset();
      setShowEntryForm(false);
      setEditingEntry(null);
      await refreshAll();
    }, editingEntry ? "Opération modifiée." : "Opération enregistrée.");
  }

  async function removeEntry(id: string) {
    if (!window.confirm("Déplacer cette opération dans la corbeille ?")) return;
    await runAction(async () => {
      await requestJson(`/api/transactions/${id}`, { method: "DELETE" });
      await refreshAll();
    }, "Opération déplacée dans la corbeille.");
  }

  async function submitItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await runAction(async () => {
      await requestJson("/api/items", {
        method: "POST",
        body: JSON.stringify({
          title: data.get("title"), category: data.get("category"), estimatedAmount: data.get("estimatedAmount") || undefined,
          actualAmount: data.get("actualAmount") || undefined, depositAmount: data.get("depositAmount") || undefined,
          storeName: data.get("storeName"), url: data.get("url") || undefined, priority: data.get("priority"),
          status: data.get("status"), dueDate: data.get("dueDate") ? new Date(`${data.get("dueDate")}T12:00:00`).toISOString() : undefined,
          note: data.get("note"),
        }),
      });
      form.reset();
      setShowItemForm(false);
      await refreshAll();
    }, "Élément ajouté à vos préparatifs.");
  }

  async function setOpinion(item: Item, opinion: Review["opinion"]) {
    await runAction(async () => {
      await requestJson(`/api/items/${item.id}/review`, {
        method: "POST",
        body: JSON.stringify({
          opinion,
          comment: reviewDrafts[item.id] || "",
          score: reviewScores[item.id] ? Number(reviewScores[item.id]) : undefined,
        }),
      });
      await refreshAll();
    }, "Votre avis est enregistré.");
  }

  async function uploadPhoto(item: Item, file: File | undefined) {
    if (!file) return;
    await runAction(async () => {
      const uploadFile = await compressPhoto(file);
      if (uploadFile.size > 4 * 1024 * 1024) throw new Error("La photo doit faire 4 Mo maximum après compression.");
      const formData = new FormData();
      formData.set("photo", uploadFile);
      const response = await fetch(`/api/items/${item.id}/photos`, { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Envoi de la photo impossible.");
      await refreshAll();
    }, "Photo ajoutée.");
  }

  async function uploadHousingPhoto(option: HousingOption, file: File | undefined) {
    if (!file) return;
    await runAction(async () => {
      const uploadFile = await compressPhoto(file);
      if (uploadFile.size > 4 * 1024 * 1024) throw new Error("La photo doit faire 4 Mo maximum après compression.");
      const formData = new FormData();
      formData.set("photo", uploadFile);
      const response = await fetch(`/api/housing/${option.id}/photos`, { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Envoi de la photo impossible.");
      await refreshAll();
    }, "Photo de visite ajoutée.");
  }

  async function submitHousing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await runAction(async () => {
      await requestJson("/api/housing", {
        method: "POST",
        body: JSON.stringify({
          name: data.get("name"), rent: data.get("rent"), charges: data.get("charges") || undefined,
          deposit: data.get("deposit") || undefined, areaM2: data.get("areaM2") || undefined,
          neighborhood: data.get("neighborhood"), address: data.get("address"), notes: data.get("notes"),
          pros: data.get("pros"), cons: data.get("cons"),
          visitDate: data.get("visitDate") ? new Date(`${data.get("visitDate")}T12:00:00`).toISOString() : undefined,
        }),
      });
      form.reset();
      setShowHousingForm(false);
      await refreshAll();
    }, "Option logement ajoutée.");
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!messageDraft.trim() && !chatPhoto) return;
    await runAction(async () => {
      if (chatPhoto) {
        const formData = new FormData();
        formData.set("body", messageDraft);
        formData.set("itemId", activeChatItem || "");
        formData.set("photo", await compressPhoto(chatPhoto));
        const response = await fetch("/api/messages/image", { method: "POST", body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Envoi de la photo impossible.");
        setChatPhoto(null);
      } else {
        await requestJson("/api/messages", {
          method: "POST",
          body: JSON.stringify({ body: messageDraft, itemId: activeChatItem }),
        });
      }
      setMessageDraft("");
      await loadMessages();
    });
  }

  async function sendInvite() {
    await runAction(async () => {
      const response = await requestJson<{ inviteUrl: string }>("/api/household/invite", {
        method: "POST", body: JSON.stringify({ email: inviteEmail || undefined }),
      });
      setInviteUrl(response.inviteUrl);
      await navigator.clipboard.writeText(response.inviteUrl).catch(() => undefined);
      await refreshAll();
    }, "Lien d’invitation prêt et copié.");
  }

  async function saveHousehold(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(async () => {
      await requestJson("/api/household", { method: "PATCH", body: JSON.stringify({ name: householdName, currencyCode }) });
      await refreshAll();
    }, "Paramètres du foyer enregistrés.");
  }

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(async () => {
      await requestJson("/api/categories", { method: "POST", body: JSON.stringify({ name: categoryName }) });
      setCategoryName("");
      await refreshAll();
    }, "Catégorie ajoutée.");
  }

  function show(viewName: View) {
    setError("");
    setSuccess("");
    setView(viewName);
  }

  if (loading) return <div className="loading-screen" role="status" aria-live="polite">Préparation de votre espace…</div>;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="nav-label">Votre espace</div>
        <nav className="nav-list" aria-label="Navigation principale">
          {navItems.map(({ key, label, icon: Icon }) => (
            <button key={key} className={`nav-button ${view === key ? "active" : ""}`} onClick={() => show(key)} aria-current={view === key ? "page" : undefined}>
              <Icon size={16} strokeWidth={1.8} />{label}{key === "chat" && unread > 0 && <span className="nav-badge">{unread}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="couple-card">
            <div className="avatar-pair">
              <span className="avatar">{initials(coupleMembers[0]?.user.name || userName)}</span>
              <span className="avatar">{initials(coupleMembers[1]?.user.name || "Votre partenaire")}</span>
            </div>
            <div><div className="couple-name">{household?.name || "Notre foyer"}</div><div className="couple-plan">{coupleMembers.length}/2 membres</div></div>
          </div>
          <button className="nav-button" style={{ marginTop: 10 }} onClick={() => void logout()}><ShieldCheck size={15} /> Se déconnecter</button>
        </div>
      </aside>

      <main className="main-area">
        <div className="mobile-top"><Brand /><div className="mobile-top-right"><span className="user-avatar">{initials(userName)}</span><button className="icon-button" aria-label="Plus de navigation" aria-expanded={mobileMoreOpen} aria-controls="mobile-more-menu" onClick={() => setMobileMoreOpen(!mobileMoreOpen)}><MoreHorizontal size={17} /></button></div></div>
        <header className="topbar">
          <div className="breadcrumb">Votre foyer <span style={{ margin: "0 6px", color: "#c5c2b9" }}>/</span> {navItems.find((item) => item.key === view)?.label}</div>
          <div className="topbar-actions"><div className="date-pill"><CalendarDays size={14} />{new Intl.DateTimeFormat("fr-TN", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</div><button className="icon-button" aria-label="Notifications" onClick={() => show("chat")}><Bell size={16} />{unread > 0 && <span className="nav-badge" style={{ position: "absolute", transform: "translate(12px,-12px)" }}>{unread}</span>}</button><div className="user-chip"><span className="user-avatar">{initials(userName)}</span>{userName}</div></div>
        </header>

        <div className="content">
          {error && <div className="error-banner" role="alert">{error}<button type="button" className="text-link" aria-label="Fermer le message d’erreur" style={{ float: "right" }} onClick={() => setError("")}>Fermer</button></div>}
          {success && <div className="success-banner" role="status">{success}<button type="button" className="text-link" aria-label="Fermer le message de confirmation" style={{ float: "right" }} onClick={() => setSuccess("")}>Fermer</button></div>}
          {view === "home" && <Dashboard
            userName={userName} entries={entries} categories={categories} items={items} currency={currencyCode}
            income={monthlyIncome} expense={monthlyExpense} weddingEstimated={weddingEstimated}
            weddingActual={weddingActual} remainingWedding={remainingWedding}
            onNewEntry={() => { setEditingEntry(null); setShowEntryForm(true); show("transactions"); }}
            onTransactions={() => show("transactions")} onWedding={() => show("wedding")}
          />}
          {view === "transactions" && <TransactionsView
            entries={entries} categories={categories} currency={currencyCode} members={coupleMembers} userId={userId} showForm={showEntryForm}
            editingEntry={editingEntry} setEditingEntry={setEditingEntry} setShowForm={setShowEntryForm}
            onSubmit={submitTransaction} onDelete={removeEntry}
          />}
          {view === "wedding" && <WeddingView
            items={items} members={coupleMembers} userId={userId} currency={currencyCode}
            decisionOnly={decisionOnly} setDecisionOnly={setDecisionOnly} showForm={showItemForm}
            setShowForm={setShowItemForm} onSubmit={submitItem} onOpinion={setOpinion} reviewDrafts={reviewDrafts}
            setReviewDrafts={setReviewDrafts} reviewScores={reviewScores} setReviewScores={setReviewScores} onPhoto={uploadPhoto} onStatus={async (item, status) => {
              await runAction(async () => { await requestJson(`/api/items/${item.id}`, { method: "PATCH", body: JSON.stringify({ status }) }); await refreshAll(); }, "Statut mis à jour.");
            }} onDelete={async (item) => {
              if (!window.confirm("Déplacer cet élément dans la corbeille ?")) return;
              await runAction(async () => { await requestJson(`/api/items/${item.id}`, { method: "DELETE" }); await refreshAll(); }, "Élément déplacé dans la corbeille.");
            }} onChat={(item) => { setActiveChatItem(item.id); show("chat"); }}
          />}
          {view === "housing" && <HousingView options={housing} currency={currencyCode} showForm={showHousingForm} setShowForm={setShowHousingForm} onSubmit={submitHousing} onPhoto={uploadHousingPhoto} onDelete={async (option) => {
            if (!window.confirm("Déplacer ce logement dans la corbeille ?")) return;
            await runAction(async () => { await requestJson(`/api/housing/${option.id}`, { method: "DELETE" }); await refreshAll(); }, "Logement déplacé dans la corbeille.");
          }} />}
          {view === "chat" && <ChatView
            messages={messages} draft={messageDraft} setDraft={setMessageDraft} onSubmit={sendMessage}
            endRef={chatEndRef} items={items} activeItem={activeChatItem}
            setActiveItem={setActiveChatItem} currentUser={userName} photo={chatPhoto} setPhoto={setChatPhoto}
          />}
          {view === "activity" && <ActivityView activities={activities} />}
          {view === "trash" && <TrashView entries={trashEntries} onRestore={async (entry) => {
            await runAction(async () => { await requestJson("/api/trash", { method: "POST", body: JSON.stringify({ id: entry.id, type: entry.type }) }); await loadTrash(); await refreshAll(); }, "Élément restauré.");
          }} />}
          {view === "household" && <HouseholdView
            household={household} name={householdName} setName={setHouseholdName} currency={currencyCode}
            setCurrency={setCurrencyCode} inviteUrl={inviteUrl} inviteEmail={inviteEmail} setInviteEmail={setInviteEmail}
            onInvite={sendInvite} onSave={saveHousehold} categoryName={categoryName} setCategoryName={setCategoryName}
            onAddCategory={addCategory} categories={categories} onBudgetSave={async (category, monthlyCap) => {
              await runAction(async () => {
                await requestJson(`/api/categories/${category.id}`, { method: "PATCH", body: JSON.stringify({ monthlyCap }) });
                await refreshAll();
              }, "Plafond mensuel enregistré.");
            }} onTrash={() => show("trash")} onActivity={() => show("activity")}
          />}
        </div>
      </main>
      {mobileMoreOpen && <div className="mobile-more-menu" id="mobile-more-menu" role="menu">
        <button className="button-quiet" onClick={() => { show("activity"); setMobileMoreOpen(false); }}><ClipboardList size={15} /> Historique</button>
        <button className="button-quiet" onClick={() => { show("household"); setMobileMoreOpen(false); }}><Settings2 size={15} /> Notre foyer</button>
        <button className="button-quiet" onClick={() => { show("trash"); setMobileMoreOpen(false); }}><ArchiveRestore size={15} /> Corbeille</button>
        <button className="button-quiet" onClick={() => void logout()}><ShieldCheck size={15} /> Se déconnecter</button>
      </div>}
      <nav className="mobile-nav" aria-label="Navigation mobile">
        {[navItems[0], navItems[1], navItems[2], navItems[3], navItems[4]].map(({ key, label, icon: Icon }) => (
          <button key={key} className={`nav-button ${view === key ? "active" : ""}`} onClick={() => show(key)} aria-current={view === key ? "page" : undefined}>
            <Icon size={18} strokeWidth={1.8} />{label === "Vue d’ensemble" ? "Accueil" : label === "Mariage & achats" ? "Mariage" : label === "Logement" ? "Logement" : label === "Discussion" ? "Chat" : label}{key === "chat" && unread > 0 && <span className="nav-badge">{unread}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}

function Dashboard({
  userName, entries, categories, items, currency, income, expense, weddingEstimated, weddingActual, remainingWedding, onNewEntry, onTransactions, onWedding,
}: {
  userName: string; entries: Entry[]; categories: Category[]; items: Item[]; currency: string; income: number; expense: number;
  weddingEstimated: number; weddingActual: number; remainingWedding: number; onNewEntry: () => void; onTransactions: () => void; onWedding: () => void;
}) {
  const balance = income - expense;
  const chartMonths = Array.from({ length: 6 }, (_, index) => monthStart(index - 5));
  const chartTotals = chartMonths.map((month) => {
    const monthEntries = entries.filter((entry) => {
      const date = new Date(entry.date);
      return date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear();
    });
    return {
      income: monthEntries.filter((entry) => entry.type === "INCOME").reduce((sum, entry) => sum + Number(entry.amount), 0),
      expense: monthEntries.filter((entry) => entry.type === "EXPENSE").reduce((sum, entry) => sum + Number(entry.amount), 0),
    };
  });
  const maxChart = Math.max(1, ...chartTotals.flatMap((row) => [row.income, row.expense]));
  const byCategory = categories.map((category) => {
    const total = entries.filter((entry) => entry.type === "EXPENSE" && entry.category === category.name && new Date(entry.date).getMonth() === new Date().getMonth()).reduce((sum, entry) => sum + Number(entry.amount), 0);
    return { ...category, total };
  }).filter((category) => category.total > 0).sort((a, b) => b.total - a.total).slice(0, 5);
  const unpaid = items.filter((item) => !["PAID"].includes(item.status)).length;
  return (
    <>
      <div className="welcome">
        <div><div className="eyebrow">{new Intl.DateTimeFormat("fr-TN", { month: "long", year: "numeric" }).format(new Date())}</div><h1>Bonjour, {userName.split(" ")[0]} <span style={{ color: "#bd8f78" }}>✳</span></h1><p>Un petit point sur vos projets et votre budget commun.</p></div>
        <button className="button-primary" onClick={onNewEntry}><Plus size={15} /> Ajouter une opération</button>
      </div>
      <div className="stats-grid">
        <StatCard label="Revenus du mois" value={formatCurrency(income, currency)} icon={TrendingUp} foot="Total entrées ce mois-ci" positive />
        <StatCard label="Dépenses du mois" value={formatCurrency(expense, currency)} icon={TrendingDown} foot={`${currentMonthCount(entries)} opérations enregistrées`} />
        <StatCard label="Disponible ce mois" value={formatCurrency(balance, currency)} icon={Wallet} foot={balance >= 0 ? "Vous êtes dans le vert" : "Dépassement du budget"} positive={balance >= 0} />
        <StatCard label="Budget préparatifs" value={formatCurrency(weddingEstimated, currency)} icon={Heart} foot={`Réel ${formatCurrency(weddingActual, currency)} · reste ${formatCurrency(remainingWedding, currency)} · ${unpaid} à finaliser`} />
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading"><div><h2 className="panel-title">Votre rythme financier</h2><p className="panel-caption">Revenus et dépenses, 6 derniers mois</p></div><span className="select-small">{monthName(new Date())} <ChevronDown size={11} style={{ verticalAlign: "middle" }} /></span></div>
          <div className="chart-area" aria-label="Graphique des revenus et dépenses des six derniers mois">
            {chartTotals.map((row, index) => <div className="chart-group" key={chartMonths[index].toISOString()}>
              <div className="chart-bar" style={{ height: `${Math.max(3, row.income / maxChart * 88)}%` }} title={`Revenus ${formatCurrency(row.income, currency)}`} />
              <div className="chart-bar expense" style={{ height: `${Math.max(3, row.expense / maxChart * 88)}%` }} title={`Dépenses ${formatCurrency(row.expense, currency)}`} />
            </div>)}
          </div>
          <div className="chart-labels">{chartMonths.map((month) => <span key={month.toISOString()}>{monthName(month, true).replace(".", "")}</span>)}</div>
          <div className="legend"><span className="legend-item"><i className="legend-dot" /> Revenus</span><span className="legend-item"><i className="legend-dot warm" /> Dépenses</span></div>
        </section>
        <section className="panel">
          <div className="panel-heading"><div><h2 className="panel-title">Où va votre budget ?</h2><p className="panel-caption">Dépenses par catégorie, ce mois</p></div><button className="button-quiet" onClick={onTransactions}>Tout voir <ArrowUpRight size={13} /></button></div>
          {byCategory.length ? <div className="category-list">{byCategory.map((category) => {
            const cap = Number(category.monthlyCap || 0);
            const pct = cap > 0 ? category.total / cap * 100 : 0;
            return <div className="category-row" key={category.id}>
              <span className="category-dot" style={{ background: `${category.color}20`, color: category.color }}><CircleDollarSign size={15} /></span>
              <div><div className="category-name">{category.name}</div><div className="category-sub">{cap ? `${formatCurrency(category.total, currency)} sur ${formatCurrency(cap, currency)}` : "Pas de plafond défini"}</div>{cap > 0 && <div className="progress-track"><div className={`progress-value ${pct > 100 ? "over" : ""}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>}</div>
              <div className="category-amount">{formatCurrency(category.total, currency)}</div>
            </div>;
          })}</div> : <div className="empty-state">Vos dépenses par catégorie apparaîtront ici.</div>}
        </section>
      </div>
      <section className="panel section-spacer">
        <div className="panel-heading"><div><h2 className="panel-title">Les dernières opérations</h2><p className="panel-caption">Un suivi clair, sans rien oublier.</p></div><button className="button-quiet" onClick={onTransactions}>Voir l’historique <ArrowUpRight size={13} /></button></div>
        <TransactionList entries={entries.slice(0, 5)} currency={currency} />
      </section>
      <section className="panel section-spacer">
        <div className="panel-heading"><div><h2 className="panel-title">Vos préparatifs avancent</h2><p className="panel-caption">{items.length} éléments dans votre liste</p></div><button className="button-quiet" onClick={onWedding}>Voir la liste <ArrowUpRight size={13} /></button></div>
        {items.length ? <div className="review-row">{items.slice(0, 5).map((item) => <span key={item.id} className="review-chip">{item.title} · {statusLabel[item.status] || item.status}</span>)}</div> : <div className="empty-state">Ajoutez vos premiers achats ou réservations à prévoir.</div>}
      </section>
    </>
  );
}

function currentMonthCount(entries: Entry[]) {
  const now = new Date();
  return entries.filter((entry) => { const date = new Date(entry.date); return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear(); }).length;
}

function StatCard({ label, value, icon: Icon, foot, positive }: { label: string; value: string; icon: typeof Home; foot: string; positive?: boolean }) {
  return <article className="stat-card"><div className="stat-head">{label}<span className="stat-icon"><Icon size={15} /></span></div><div className={`stat-value ${positive ? "positive" : ""}`}>{value}</div><div className="stat-foot">{foot}</div></article>;
}

function TransactionList({ entries, currency, onDelete, onEdit }: {
  entries: Entry[]; currency: string; onDelete?: (id: string) => void; onEdit?: (entry: Entry) => void;
}) {
  if (!entries.length) return <div className="empty-state">Aucune opération enregistrée pour le moment.</div>;
  return <div className="transaction-list">{entries.map((entry) => <div className="transaction-row" key={entry.id}>
    <span className={`transaction-symbol ${entry.type === "EXPENSE" ? "expense" : ""}`}>{entry.type === "EXPENSE" ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}</span>
    <div><div className="transaction-name">{entry.note || entry.category}</div>    <div className="transaction-meta">{entry.category} · Pour {entry.owner?.name || "le foyer"} · Saisi par {entry.author.name || "Partenaire"}{entry.paymentMethod ? ` · ${entry.paymentMethod}` : ""}</div></div>
    <div className={`transaction-value ${entry.type === "INCOME" ? "positive" : ""}`}>{entry.type === "INCOME" ? "+" : "−"}{formatCurrency(entry.amount, currency)}</div>
    <div className="transaction-date">{dateLabel(entry.date)}</div>
    {(onEdit || onDelete) && <div className="transaction-actions">
      {onEdit && <button className="transaction-edit" aria-label={`Modifier ${entry.note || entry.category}`} onClick={() => onEdit(entry)}><Pencil size={13} /></button>}
      {onDelete && <button className="transaction-delete" aria-label={`Mettre ${entry.note || entry.category} dans la corbeille`} onClick={() => onDelete(entry.id)}><Trash2 size={13} /></button>}
    </div>}
  </div>)}</div>;
}

function TransactionsView({ entries, categories, currency, members, userId, showForm, editingEntry, setEditingEntry, setShowForm, onSubmit, onDelete }: {
  entries: Entry[]; categories: Category[]; currency: string; members: Household["members"]; userId: string; showForm: boolean; setShowForm: (show: boolean) => void;
  editingEntry: Entry | null; setEditingEntry: (entry: Entry | null) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void; onDelete: (id: string) => void;
}) {
  const [filter, setFilter] = useState<"ALL" | "INCOME" | "EXPENSE">("ALL");
  const filtered = entries.filter((entry) => filter === "ALL" || entry.type === filter);
  return <>
    <div className="section-head"><div><div className="eyebrow">Votre quotidien</div><h2>Opérations</h2><p>Chaque centime compte. Gardez une trace sans effort.</p></div><div className="toolbar"><a className="button-secondary" href="/api/export"><Download size={14} /> Export CSV</a><button className="button-primary" onClick={() => { setEditingEntry(null); setShowForm(editingEntry ? true : !showForm); }}><Plus size={15} /> Ajouter</button></div></div>
    {showForm && <form key={editingEntry?.id || "new"} className="form-panel" onSubmit={onSubmit}>
      <div className="panel-heading"><div><h3 className="panel-title">{editingEntry ? "Modifier l’opération" : "Nouvelle opération"}</h3><p className="panel-caption">Saisie rapide · montants en 3 décimales</p></div><button type="button" className="button-quiet" onClick={() => { setShowForm(false); setEditingEntry(null); }}>Fermer</button></div>
      <div className="form-grid">
        <Field label="Type"><select name="type" defaultValue={editingEntry?.type || "EXPENSE"}><option value="EXPENSE">Dépense</option><option value="INCOME">Revenu</option></select></Field>
        <Field label={`Montant (${currencyNames[currency] || currency})`}><input name="amount" type="number" step="0.001" min="0.001" required placeholder="0.000" inputMode="decimal" defaultValue={editingEntry?.amount} /></Field>
        <Field label="Catégorie"><select name="category" required defaultValue={editingEntry?.category || ""}><option value="" disabled>Choisir une catégorie</option>{editingEntry && !categories.some((category) => category.name === editingEntry.category) && <option value={editingEntry.category}>{editingEntry.category}</option>}{categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}</select></Field>
        <Field label="Pour qui ?"><select name="ownerId" defaultValue={editingEntry?.owner?.id || ""}><option value="">Le foyer (commun)</option><option value={userId}>Moi — {members.find((member) => member.userId === userId)?.user.name || "mon compte"}</option>{members.filter((member) => member.userId !== userId).map((member) => <option key={member.userId} value={member.userId}>{member.user.name || "Partenaire"}</option>)}</select></Field>
        <Field label="Moyen de paiement"><select name="paymentMethod" defaultValue={editingEntry?.paymentMethod || ""}><option value="">Non précisé</option><option>Espèces</option><option>Carte bancaire</option><option>Virement</option><option>Chèque</option><option>Autre</option></select></Field>
        <Field label="Date"><input name="date" type="date" defaultValue={editingEntry ? new Date(new Date(editingEntry.date).getTime() - new Date(editingEntry.date).getTimezoneOffset() * 60000).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)} required /></Field>
        {!editingEntry && <Field label="Répéter"><select name="frequency"><option value="">Jamais</option><option value="WEEKLY">Chaque semaine</option><option value="MONTHLY">Chaque mois</option><option value="YEARLY">Chaque année</option></select></Field>}
        <Field label="Note (facultatif)"><input name="note" maxLength={500} placeholder="Ex. Marché, cigarettes…" defaultValue={editingEntry?.note || ""} /></Field>
      </div>
      <div className="form-actions">      <button type="button" className="button-secondary" onClick={() => { setShowForm(false); setEditingEntry(null); }}>Annuler</button><button className="button-primary"><Check size={14} /> {editingEntry ? "Enregistrer les modifications" : "Enregistrer l’opération"}</button></div>
    </form>}
    <section className="panel section-spacer">
      <div className="panel-heading"><div><h3 className="panel-title">Historique du foyer</h3><p className="panel-caption">{filtered.length} opération{filtered.length > 1 ? "s" : ""} · chaque modification est tracée</p></div><div className="filter-tabs">{(["ALL", "EXPENSE", "INCOME"] as const).map((value) => <button key={value} className={`filter-tab ${filter === value ? "selected" : ""}`} onClick={() => setFilter(value)}>{value === "ALL" ? "Tout" : value === "EXPENSE" ? "Dépenses" : "Revenus"}</button>)}</div></div>
      <TransactionList entries={filtered} currency={currency} onDelete={onDelete} onEdit={(entry) => { setEditingEntry(entry); setShowForm(true); }} />
    </section>
  </>;
}

function Field({ label, children, full = false }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={`form-field ${full ? "full" : ""}`}><label>{label}</label>{children}</div>;
}

function WeddingView({ items, members, userId, currency, decisionOnly, setDecisionOnly, showForm, setShowForm, onSubmit, onOpinion, reviewDrafts, setReviewDrafts, reviewScores, setReviewScores, onPhoto, onStatus, onDelete, onChat }: {
  items: Item[]; members: Household["members"]; userId: string; currency: string; decisionOnly: boolean; setDecisionOnly: (value: boolean) => void;
  showForm: boolean; setShowForm: (value: boolean) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onOpinion: (item: Item, opinion: Review["opinion"]) => void; reviewDrafts: Record<string, string>;
  setReviewDrafts: (value: Record<string, string>) => void; reviewScores: Record<string, string>; setReviewScores: (value: Record<string, string>) => void;
  onPhoto: (item: Item, file: File | undefined) => void;
  onStatus: (item: Item, status: string) => void; onDelete: (item: Item) => void; onChat: (item: Item) => void;
}) {
  const list = decisionOnly ? items.filter((item) => item.reviews.length < members.length || new Set(item.reviews.map((review) => review.opinion)).size > 1) : items;
  const estimates = items.reduce((sum, item) => sum + Number(item.estimatedAmount || 0), 0);
  const actuals = items.reduce((sum, item) => sum + Number(item.actualAmount || 0), 0);
  return <>
    <div className="section-head"><div><div className="eyebrow">Un projet après l’autre</div><h2>Mariage & achats</h2><p>Vos idées, vos comparatifs, vos décisions à deux.</p></div><div className="toolbar"><button className={`button-secondary ${decisionOnly ? "active" : ""}`} onClick={() => setDecisionOnly(!decisionOnly)}><Sparkles size={14} /> À décider</button><button className="button-primary" onClick={() => setShowForm(!showForm)}><Plus size={15} /> Ajouter</button></div></div>
    <div className="stats-grid" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
      <StatCard label="Budget estimé" value={formatCurrency(estimates, currency)} icon={CircleDollarSign} foot={`${items.length} éléments prévus`} />
      <StatCard label="Coût réel engagé" value={formatCurrency(actuals, currency)} icon={ShoppingBag} foot="Prix réels saisis" />
      <StatCard label="Reste estimé" value={formatCurrency(Math.max(0, estimates - actuals), currency)} icon={Wallet} foot="Estimation moins réel" positive />
    </div>
    {showForm && <form className="form-panel section-spacer" onSubmit={onSubmit}>
      <div className="panel-heading"><div><h3 className="panel-title">Ajouter un élément</h3><p className="panel-caption">Achat, réservation ou idée à comparer</p></div><button type="button" className="button-quiet" onClick={() => setShowForm(false)}>Fermer</button></div>
      <div className="form-grid">
        <Field label="Nom"><input name="title" required maxLength={120} placeholder="Ex. Salle de réception" /></Field>
        <Field label="Catégorie"><input name="category" required maxLength={60} placeholder="Salle, tenues, meubles…" /></Field>
        <Field label={`Prix estimé (${currencyNames[currency] || currency})`}><input name="estimatedAmount" type="number" min="0" step="0.001" inputMode="decimal" placeholder="0.000" /></Field>
        <Field label="Prix réel"><input name="actualAmount" type="number" min="0" step="0.001" inputMode="decimal" placeholder="0.000" /></Field>
        <Field label="Acompte versé"><input name="depositAmount" type="number" min="0" step="0.001" inputMode="decimal" placeholder="0.000" /></Field>
        <Field label="Priorité"><select name="priority"><option value="MEDIUM">Normale</option><option value="HIGH">Haute</option><option value="LOW">Basse</option></select></Field>
        <Field label="Statut"><select name="status"><option value="IDEA">Idée</option><option value="COMPARING">En comparaison</option><option value="DECIDED">Décidé</option><option value="PURCHASED">Acheté</option><option value="PAID">Payé</option></select></Field>
        <Field label="Date limite"><input name="dueDate" type="date" /></Field>
        <Field label="Magasin / prestataire"><input name="storeName" maxLength={120} placeholder="Nom du magasin" /></Field>
        <Field label="Lien"><input name="url" type="url" placeholder="https://" /></Field>
        <Field label="Notes" full><textarea name="note" maxLength={1000} placeholder="Détails, mesures, questions à poser…" /></Field>
      </div>
      <div className="form-actions"><button type="button" className="button-secondary" onClick={() => setShowForm(false)}>Annuler</button><button className="button-primary"><Check size={14} /> Enregistrer</button></div>
    </form>}
    <div className="item-grid section-spacer">{list.map((item) => {
      const own = item.reviews.find((review) => review.author.id === userId);
      const opinions = new Set(item.reviews.map((review) => review.opinion));
      const statusText = item.reviews.length < members.length ? "En attente d’un avis" : opinions.size > 1 ? "À discuter ensemble" : "Vous êtes d’accord";
      const statusTone = item.reviews.length < members.length ? "" : opinions.size > 1 ? "high" : "";
      const latestPhoto = item.photos.at(-1);
      return <article className="item-card" key={item.id}>
        {latestPhoto ? <Image className="item-photo" src={`/api/items/${item.id}/photos/${latestPhoto.id}`} width={800} height={500} unoptimized alt={`Photo : ${item.title}`} /> : <div className="item-photo-placeholder"><ImagePlus size={27} strokeWidth={1.2} /></div>}
        <div className="item-body">
          <div className="item-top"><div><h3 className="item-name">{item.title}</h3><div className="item-category">{item.category}{item.storeName ? ` · ${item.storeName}` : ""}{item.dueDate ? ` · avant le ${dateLabel(item.dueDate)}` : ""}</div></div><span className={`status-pill ${item.priority === "HIGH" ? "high" : ""}`}>{statusLabel[item.status] || item.status}</span></div>
          <div className="item-price-row"><div><div className="item-price-label">Estimé</div><div className="item-price">{formatCurrency(item.estimatedAmount, currency)}</div></div><div><div className="item-price-label">Réel</div><div className="item-price">{item.actualAmount ? formatCurrency(item.actualAmount, currency) : "—"}</div></div><div><div className="item-price-label">Acompte</div><div className="item-price">{item.depositAmount ? formatCurrency(item.depositAmount, currency) : "—"}</div></div></div>
          {item.note && <p className="item-note">{item.note}</p>}
          <div className="decision-block"><div className="decision-title">Décision à deux · <span className={`status-pill ${statusTone}`} style={{ display: "inline-block", padding: "3px 7px" }}>{statusText}</span></div>
            <div className="review-row">{item.reviews.map((review) => <span className={`review-chip ${review.opinion === "LIKE" ? "like" : review.opinion === "DISLIKE" ? "dislike" : ""}`} key={review.id}>{review.author.name || "Partenaire"} · {opinionLabel[review.opinion]}{review.score ? ` · ${review.score}/5` : ""}{review.comment ? ` — ${review.comment}` : ""}</span>)}</div>
            <div className="review-actions">{(["LIKE", "MAYBE", "DISLIKE"] as const).map((opinion) => <button key={opinion} className={`review-action ${own?.opinion === opinion ? "selected" : ""}`} onClick={() => onOpinion(item, opinion)}>{opinion === "LIKE" ? "J’aime" : opinion === "MAYBE" ? "Bof" : "Non"}</button>)}</div>
            <input aria-label={`Commentaire pour ${item.title}`} value={reviewDrafts[item.id] ?? own?.comment ?? ""} onChange={(event) => setReviewDrafts({ ...reviewDrafts, [item.id]: event.target.value })} placeholder="Ajouter un commentaire à votre avis…" style={{ width: "100%", marginTop: 8, border: "1px solid var(--line)", borderRadius: 8, padding: "7px 9px", fontSize: 10 }} />
            <label style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8, color: "#8e8f85", fontSize: 9 }}>Votre note
              <select aria-label={`Note sur 5 pour ${item.title}`} className="select-small" value={reviewScores[item.id] ?? String(own?.score || "")} onChange={(event) => setReviewScores({ ...reviewScores, [item.id]: event.target.value })}><option value="">Sans note</option>{[1, 2, 3, 4, 5].map((score) => <option key={score} value={score}>{score} / 5</option>)}</select>
            </label>
          </div>
          <div className="item-footer">
            <label className="tag-button"><Camera size={13} /> Photo<input className="file-input" type="file" accept="image/*" capture="environment" onChange={(event) => { void onPhoto(item, event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} /></label>
            <button className="tag-button" onClick={() => onChat(item)}><MessageCircle size={13} /> Discussion</button>
            {item.url && <a className="tag-button" href={item.url} target="_blank" rel="noreferrer">Ouvrir le lien <ArrowUpRight size={12} /></a>}
            <select className="select-small" aria-label={`Statut de ${item.title}`} value={item.status} onChange={(event) => onStatus(item, event.target.value)}>{Object.entries(statusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
            <button className="transaction-delete" aria-label={`Mettre ${item.title} dans la corbeille`} onClick={() => onDelete(item)}><Trash2 size={13} /></button>
          </div>
        </div>
      </article>;
    })}</div>
    {!list.length && <div className="panel empty-state section-spacer">{decisionOnly ? "Tout est décidé entre vous. Bravo !" : "Votre liste est encore vide. Ajoutez vos idées, achats et réservations."}</div>}
  </>;
}

function HousingView({ options, currency, showForm, setShowForm, onSubmit, onPhoto, onDelete }: {
  options: HousingOption[]; currency: string; showForm: boolean; setShowForm: (value: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void; onPhoto: (option: HousingOption, file: File | undefined) => void; onDelete: (option: HousingOption) => void;
}) {
  return <>
    <div className="section-head"><div><div className="eyebrow">Votre prochain chez-vous</div><h2>Logement</h2><p>Comparez les options, préparez les visites, gardez vos notes.</p></div><button className="button-primary" onClick={() => setShowForm(!showForm)}><Plus size={15} /> Ajouter un logement</button></div>
    {showForm && <form className="form-panel" onSubmit={onSubmit}><div className="form-grid">
      <Field label="Nom / référence"><input name="name" required placeholder="Appartement La Marsa" /></Field>
      <Field label="Loyer mensuel"><input name="rent" type="number" step="0.001" min="0" inputMode="decimal" required placeholder="0.000" /></Field>
      <Field label="Charges"><input name="charges" type="number" step="0.001" min="0" placeholder="0.000" /></Field>
      <Field label="Caution"><input name="deposit" type="number" step="0.001" min="0" placeholder="0.000" /></Field>
      <Field label="Surface (m²)"><input name="areaM2" type="number" step="0.01" min="0" placeholder="75" /></Field>
      <Field label="Quartier"><input name="neighborhood" placeholder="La Marsa" /></Field>
      <Field label="Adresse"><input name="address" placeholder="Adresse du logement" /></Field>
      <Field label="Date de visite"><input name="visitDate" type="date" /></Field>
      <Field label="Points positifs" full><textarea name="pros" placeholder="Lumineux, proche du travail…" /></Field>
      <Field label="Points à vérifier" full><textarea name="cons" placeholder="Travaux, bruit, trajet…" /></Field>
      <Field label="Notes de visite" full><textarea name="notes" placeholder="Vos impressions à chaud…" /></Field>
    </div><div className="form-actions"><button type="button" className="button-secondary" onClick={() => setShowForm(false)}>Annuler</button><button className="button-primary"><Check size={14} /> Enregistrer</button></div></form>}
    <div className="item-grid section-spacer">{options.map((option) => <article className="housing-card" key={option.id}>
      <h3>{option.name}</h3><div className="housing-meta">{option.neighborhood || option.address || "Quartier à préciser"}{option.visitDate ? ` · Visite le ${dateLabel(option.visitDate)}` : ""}</div>
      <div className="housing-amount">{formatCurrency(Number(option.rent) + Number(option.charges || 0), currency)} <span>/ mois charges comprises</span></div>
      <div className="review-row"><span className="review-chip">Loyer {formatCurrency(option.rent, currency)}</span>{option.charges ? <span className="review-chip">Charges {formatCurrency(option.charges, currency)}</span> : null}{option.deposit ? <span className="review-chip">Caution {formatCurrency(option.deposit, currency)}</span> : null}{option.areaM2 ? <span className="review-chip">{Number(option.areaM2)} m²</span> : null}</div>
      {(option.pros || option.cons) && <div className="pros-cons"><div><strong className="positive">Pour</strong><br />{option.pros || "—"}</div><div><strong className="negative">À vérifier</strong><br />{option.cons || "—"}</div></div>}
      {option.notes && <p className="item-note" style={{ marginTop: 12 }}>{option.notes}</p>}
      {option.photos.length > 0 && <div className="item-photo-gallery">{option.photos.map((photo) => <Image key={photo.id} width={156} height={130} unoptimized src={`/api/housing/${option.id}/photos/${photo.id}`} alt={`Visite : ${option.name}`} />)}</div>}
      <label className="tag-button" style={{ marginTop: 12 }}><Camera size={13} /> Ajouter une photo de visite<input className="file-input" type="file" accept="image/*" capture="environment" onChange={(event) => { void onPhoto(option, event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} /></label>
      <button className="transaction-delete" aria-label={`Mettre ${option.name} dans la corbeille`} onClick={() => onDelete(option)} style={{ float: "right", marginTop: 13 }}><Trash2 size={13} /></button>
    </article>)}</div>
    {!options.length && !showForm && <div className="panel empty-state section-spacer">Ajoutez plusieurs logements pour comparer loyer, charges, surface et impressions de visite.</div>}
  </>;
}

function ChatView({ messages, draft, setDraft, onSubmit, endRef, items, activeItem, setActiveItem, currentUser, photo, setPhoto }: {
  messages: ChatMessage[]; draft: string; setDraft: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  endRef: React.RefObject<HTMLDivElement | null>; items: Item[]; activeItem: string | null; setActiveItem: (id: string | null) => void;
  currentUser: string; photo: File | null; setPhoto: (value: File | null) => void;
}) {
  const item = items.find((entry) => entry.id === activeItem);
  return <>
    <div className="section-head"><div><div className="eyebrow">Votre espace privé</div><h2>Discussion</h2><p>Vos décisions méritent une vraie conversation.</p></div><div className="toolbar"><select className="select-small" value={activeItem || ""} onChange={(event) => setActiveItem(event.target.value || null)}><option value="">Discussion générale</option>{items.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}</select></div></div>
    <section className="chat-wrap">
      <div className="chat-heading"><span className="stat-icon"><MessageCircle size={16} /></span><div><h3>{item ? item.title : "Le coin des deux"}</h3><p>{item ? "Discussion liée à cet élément" : "Votre conversation privée · actualisée en direct"}</p></div></div>
      <div className="chat-messages">{messages.map((message) => <div key={message.id} className={`chat-message ${message.author.name === currentUser ? "mine" : ""}`}>
        <div className="chat-author">{message.author.name || "Partenaire"}</div><div className="chat-bubble">{message.body}{message.imageUrl && <a href={message.imageUrl} target="_blank" rel="noreferrer"><Image src={message.imageUrl} width={440} height={250} unoptimized alt="Photo envoyée" style={{ display: "block", width: "100%", height: "auto", maxWidth: 220, marginTop: 8, borderRadius: 9 }} /></a>}</div><div className="chat-time">{new Intl.DateTimeFormat("fr-TN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }).format(new Date(message.createdAt))}</div>
      </div>)}{!messages.length && <div className="empty-state">La conversation commence ici. Envoyez un petit message.</div>}<div ref={endRef} /></div>
      <form className="chat-form" onSubmit={onSubmit}>
        <label className="tag-button" aria-label="Joindre une photo"><ImagePlus size={15} /><input className="file-input" type="file" accept="image/*" onChange={(event) => setPhoto(event.currentTarget.files?.[0] || null)} /></label>
        <textarea aria-label="Votre message" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={photo ? `Photo : ${photo.name}` : "Écrivez votre message…"} maxLength={2000} />
        <button className="button-primary" aria-label="Envoyer" disabled={!draft.trim() && !photo}><Send size={15} /></button>
      </form>
    </section>
  </>;
}

function ActivityView({ activities }: { activities: Activity[] }) {
  return <>
    <div className="section-head"><div><div className="eyebrow">La mémoire du foyer</div><h2>Historique</h2><p>Chaque action garde son auteur et son heure.</p></div></div>
    <section className="panel"><div className="activity-list">{activities.map((activity) => <div className="activity-row" key={activity.id}>
      <span className="activity-mark"><ClipboardList size={15} /></span><div className="activity-text"><strong>{activity.actor.name || activity.actor.email}</strong> {activity.action}{activity.before || activity.after ? <details style={{ marginTop: 5, color: "#8d8e85" }}><summary style={{ cursor: "pointer", fontSize: 10 }}>Voir les valeurs enregistrées</summary><pre style={{ overflow: "auto", maxWidth: "100%", fontSize: 9 }}>{JSON.stringify({ avant: activity.before, après: activity.after }, null, 2)}</pre></details> : null}</div><time className="activity-time">{new Intl.DateTimeFormat("fr-TN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(activity.createdAt))}</time>
    </div>)}{!activities.length && <div className="empty-state">Les actions du foyer s’afficheront ici.</div>}</div></section>
  </>;
}

function TrashView({ entries, onRestore }: {
  entries: { id: string; type: "transaction" | "weddingItem" | "housingOption"; title: string; deletedAt: string | null }[];
  onRestore: (entry: { id: string; type: "transaction" | "weddingItem" | "housingOption"; title: string; deletedAt: string | null }) => void;
}) {
  const typeNames = { transaction: "Opération", weddingItem: "Préparatif", housingOption: "Logement" };
  return <>
    <div className="section-head"><div><div className="eyebrow">Rien n’est perdu</div><h2>Corbeille</h2><p>Les éléments supprimés peuvent être restaurés à tout moment.</p></div></div>
    <section className="panel"><div className="transaction-list">{entries.map((entry) => <div className="transaction-row" key={`${entry.type}-${entry.id}`}>
      <span className="transaction-symbol"><ArchiveRestore size={15} /></span><div><div className="transaction-name">{entry.title}</div><div className="transaction-meta">{typeNames[entry.type]} · supprimé le {entry.deletedAt ? dateLabel(entry.deletedAt) : "—"}</div></div>
      <button className="button-secondary" onClick={() => onRestore(entry)}><ArchiveRestore size={13} /> Restaurer</button>
    </div>)}{!entries.length && <div className="empty-state">La corbeille est vide.</div>}</div></section>
  </>;
}

function HouseholdView({ household, name, setName, currency, setCurrency, inviteUrl, inviteEmail, setInviteEmail, onInvite, onSave, categoryName, setCategoryName, onAddCategory, categories, onBudgetSave, onTrash, onActivity }: {
  household: Household | null; name: string; setName: (value: string) => void; currency: string; setCurrency: (value: string) => void;
  inviteUrl: string; inviteEmail: string; setInviteEmail: (value: string) => void; onInvite: () => void; onSave: (event: FormEvent<HTMLFormElement>) => void;
  categoryName: string; setCategoryName: (value: string) => void; onAddCategory: (event: FormEvent<HTMLFormElement>) => void; categories: Category[];
  onBudgetSave: (category: Category, monthlyCap: number | null) => void; onTrash: () => void; onActivity: () => void;
}) {
  const [capDrafts, setCapDrafts] = useState<Record<string, string>>({});
  return <>
    <div className="section-head"><div><div className="eyebrow">Les paramètres à deux</div><h2>Notre foyer</h2><p>Invitez votre partenaire et personnalisez votre espace.</p></div></div>
    <div className="dashboard-grid">
      <section className="panel"><div className="panel-heading"><div><h3 className="panel-title">Les membres</h3><p className="panel-caption">{household?.members.length || 0} membre(s) · limite de deux comptes par foyer</p></div></div>
        {household?.members.map((member) => <div className="member-row" key={member.id}><span className="user-avatar">{initials(member.user.name)}</span><div className="member-info">{member.user.name || "Membre"}<div className="member-email">{member.user.email}</div></div><span className="review-chip">{member.role === "OWNER" ? "Créateur" : "Partenaire"}</span></div>)}
        {household && household.members.length < 2 && <div className="section-spacer"><h3 className="panel-title" style={{ fontSize: 16 }}>Inviter votre partenaire</h3><p className="panel-caption" style={{ lineHeight: 1.6 }}>Le lien est privé, utilisable une fois et expire au bout de 7 jours.</p><div className="form-field" style={{ marginTop: 12 }}><label htmlFor="invite-email">E-mail du partenaire (facultatif)</label><input id="invite-email" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="partenaire@exemple.tn" /></div><button className="button-primary" style={{ marginTop: 11 }} onClick={onInvite}><Heart size={14} /> Générer le lien</button>{inviteUrl && <div className="success-banner" style={{ marginTop: 12, marginBottom: 0, overflowWrap: "anywhere" }}>Lien à partager : <a href={inviteUrl}>{inviteUrl}</a></div>}</div>}
      </section>
      <div style={{ display: "grid", alignContent: "start", gap: 14 }}>
        <section className="panel"><div className="panel-heading"><div><h3 className="panel-title">Préférences</h3><p className="panel-caption">Nom du foyer et devise d’affichage.</p></div></div>
          <form onSubmit={onSave}><div className="form-grid"><Field label="Nom du foyer"><input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required /></Field><Field label="Devise"><select value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="TND">Dinar tunisien (TND)</option><option value="EUR">Euro (EUR)</option><option value="USD">Dollar US (USD)</option></select></Field></div><div className="form-actions"><button className="button-primary"><Check size={14} /> Enregistrer</button></div></form>
        </section>
        <section className="panel"><div className="panel-heading"><div><h3 className="panel-title">Catégories & plafonds</h3><p className="panel-caption">Un plafond dépassé apparaît en alerte sur le tableau de bord.</p></div></div>
          <div className="budget-edit-list">{categories.map((category) => <div className="budget-edit-row" key={category.id}><span>{category.name}</span><input aria-label={`Plafond mensuel ${category.name}`} type="number" step="0.001" min="0" placeholder="Sans plafond" value={capDrafts[category.id] ?? (category.monthlyCap === null ? "" : String(category.monthlyCap))} onChange={(event) => setCapDrafts({ ...capDrafts, [category.id]: event.target.value })} /><button className="button-quiet" onClick={() => { const cap = capDrafts[category.id] ?? (category.monthlyCap === null ? "" : String(category.monthlyCap)); onBudgetSave(category, cap === "" ? null : Number(cap)); }}><Check size={13} /> Enregistrer</button></div>)}</div>
          <form onSubmit={onAddCategory} style={{ display: "flex", gap: 8, marginTop: 12 }}><input aria-label="Nom de la catégorie" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} required maxLength={40} placeholder="Nouvelle catégorie" style={{ minWidth: 0, flex: 1, border: "1px solid var(--line)", borderRadius: 9, padding: "9px 10px", fontSize: 11 }} /><button className="button-secondary"><Plus size={13} /> Ajouter</button></form>
        </section>
        <section className="panel"><div className="panel-heading"><div><h3 className="panel-title">Confidentialité & corbeille</h3><p className="panel-caption">Les photos sont stockées dans un bucket privé et servies uniquement aux membres du foyer.</p></div></div><div className="toolbar"><button className="button-secondary" onClick={onActivity}><ClipboardList size={14} /> Historique</button><button className="button-secondary" onClick={onTrash}><ArchiveRestore size={14} /> Corbeille</button></div></section>
      </div>
    </div>
  </>;
}
