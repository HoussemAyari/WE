# DeuxNous — budget et préparatifs à deux

Application française mobile-first pour tenir le budget du foyer, préparer le mariage et le logement, recueillir les avis des deux partenaires et discuter ensemble.

## Plan produit et architecture

### Modèle de données

- **User / Account / Session** : compte indépendant par partenaire; mots de passe hachés avec bcrypt; session signée Auth.js.
- **Household / HouseholdMember / HouseholdInvite** : foyer isolé, devise du foyer et invitation à usage unique, expirant après sept jours. Un compte ne peut appartenir qu’à un foyer et un foyer est limité à deux membres.
- **Transaction / BudgetCategory / RecurringRule** : revenus et dépenses en `Decimal(14,3)`, catégories et plafonds mensuels, récurrences hebdomadaires, mensuelles ou annuelles.
- **WeddingItem / ItemReview / ItemPhoto** : estimations, coûts réels, acompte, statut, priorité, date limite, avis unique par membre, note sur cinq et photos.
- **HousingOption / HousingPhoto** : comparaison du loyer, charges, caution, surface, quartier, dates et notes de visite, pour/contre et galerie privée.
- **Message / MessageRead** : discussion générale ou liée à un élément; badge de non-lus et rafraîchissement toutes les 12 secondes.
- **ActivityLog** : auteur, heure et valeurs avant/après; opérations, éléments et logements supprimés sont mis en corbeille et restaurables.

Les contrôles d’appartenance au foyer sont faits dans chaque route serveur, avant toute lecture ou modification d’un objet. Les clés des photos ne sont pas publiées : elles sont conservées dans un bucket Supabase **privé**, et les images passent par des routes qui revérifient la session et l’appartenance au foyer. Les clés Supabase privilégiées restent côté serveur.

### Écrans livrés

1. Tableau de bord mensuel, revenus/dépenses, graphiques des six derniers mois, plafonds par catégorie et préparatifs.
2. Opérations rapides, revenus et dépenses, moyen de paiement, catégories personnalisables, récurrence, corbeille et export CSV.
3. Achats et réservations de mariage, budget estimé/réel, acompte, statut, priorité, lien, photos, avis distincts des deux partenaires, note et filtre « À décider ».
4. Comparaison des logements et fiches de visite avec galerie.
5. Discussion générale ou par élément, photos privées et indicateur de non-lus.
6. Historique d’activité, paramètres du foyer, invitation et devise TND/EUR/USD.
7. PWA installable, icône, mode autonome et page hors-ligne. Les données privées et les routes API ne sont jamais mises en cache par le service worker.

## Démarrage local

Prérequis : Node.js 20.9+, npm et un **nouveau** projet Supabase/PostgreSQL dédié à DeuxNous.

1. Dans le tableau de bord Supabase, créez un nouveau projet nommé par exemple `deuxnous-prod`; ne choisissez pas une base existante. Copiez ses URLs de pooler (transaction et session), son Project URL et sa nouvelle clé service-role.
2. Dans **Storage**, créez le bucket `deuxnous-private` et laissez l’option **Public** désactivée. Ne créez aucune règle publique. L’application utilise la clé de service uniquement côté serveur et vérifie le membre avant chaque upload et téléchargement.
3. Copiez `.env.example` vers `.env.local` et remplacez les valeurs par celles de ce nouveau projet. Créez des secrets distincts pour `AUTH_SECRET` et `CRON_SECRET` :

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

4. Installez et préparez l’application :

   ```powershell
   npm ci
   npm run db:generate
   npm run db:deploy
   npm run dev
   ```

5. Ouvrez <http://localhost:3000/inscription>, créez le premier compte, puis allez dans **Notre foyer → Générer le lien** et partagez l’invitation à votre partenaire. Le lien peut être limité à son adresse e-mail.

Données de démonstration facultatives, uniquement sur une base de développement jetable :

```powershell
npm run db:seed
```

Le seed crée `demo@deuxnous.tn` avec le mot de passe temporaire `DemoCouple2026!`. Ne lancez pas ce seed en production; changez toujours ce mot de passe si le compte de démonstration est utilisé.

## Déploiement d’un nouveau projet Vercel

1. Publiez le contenu de `mariage-app/` dans un **nouveau dépôt Git** dédié, puis dans Vercel choisissez **Add New → Project** et importez ce dépôt. Le Root Directory est la racine du dépôt (`./`). Ne reliez pas l’ancien projet Vercel et ne recopiez aucune de ses variables.
2. Dans Supabase, utilisez le projet neuf créé pour DeuxNous. La connexion poolée `DATABASE_URL` (port 6543) sert aux requêtes de l’application; `DIRECT_URL` utilise le pooler Session (port 5432) et sert aux migrations. Configurez les deux URLs depuis **Connect** dans Supabase plutôt que de reprendre celles d’un autre projet. Si le mot de passe contient des caractères spéciaux, encodez-les dans l’URL.
3. Depuis **Project → Settings → Environment Variables** dans le nouveau projet Vercel, ajoutez séparément `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` et `CRON_SECRET`. Ne préfixez aucune clé secrète par `NEXT_PUBLIC_`. Limitez les valeurs aux environnements nécessaires.
4. Remplacez `AUTH_URL` par l’URL HTTPS de ce nouveau déploiement. Générez deux secrets cryptographiques uniques et distincts pour ce déploiement; ne réutilisez pas ceux d’un autre site.
5. Appliquez la migration de cette base **neuve** depuis un terminal dans le projet :

   ```powershell
   npm ci
   $env:DATABASE_URL = "URL_POOLER_TRANSACTION_DU_NOUVEAU_PROJET"
   $env:DIRECT_URL = "URL_POOLER_SESSION_DU_NOUVEAU_PROJET"
   npm run db:deploy
   ```

   Les migrations ne modifient que cette base. La commande de build Vercel génère le client Prisma et construit Next.js.
6. Déployez. Vérifiez le projet neuf et le bucket privé avant de créer les deux comptes. `vercel.json` appelle la tâche quotidienne des récurrences. Les tâches cron Vercel et les quotas des services peuvent dépendre de leur plan; vérifiez les limites de vos comptes avant d’activer l’automatisation.

## Variables d’environnement

Voir [.env.example](./.env.example). Les variables obligatoires sont `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` et, en production, `CRON_SECRET`. `AUTH_URL` est `http://localhost:3000` localement puis l’URL HTTPS du nouveau déploiement.

## Vérification de livraison

### Automatique

```powershell
npm run typecheck
npm run lint
npm run build
```

### Parcours à tester après le déploiement

- [ ] Créer deux comptes distincts; inviter le second depuis le premier; vérifier qu’un foyer ne dépasse jamais deux membres.
- [ ] Enregistrer un revenu, une dépense à trois décimales et une récurrence; constater la présence dans l’historique puis le CSV.
- [ ] Créer une catégorie avec plafond mensuel et vérifier l’alerte après dépassement.
- [ ] Ajouter un meuble avec photo; vérifier que le fichier est dans le bucket privé et que l’URL d’image sans session répond `401`.
- [ ] Ajouter un élément, donner un avis depuis chacun des deux comptes, vérifier l’accord/désaccord et le filtre « À décider ».
- [ ] Envoyer un message texte et une photo dans le chat général et dans le fil de l’élément; vérifier le badge non-lu.
- [ ] Ajouter une option de logement et des photos de visite.
- [ ] Modifier ou mettre à la corbeille une opération, consulter l’historique et restaurer l’élément.
- [ ] Créer un troisième compte dans un autre foyer et vérifier que les API, pièces jointes, messages et exports ne lui révèlent aucune donnée des deux premiers comptes.

## Stack et scripts

- Next.js App Router, React, TypeScript, Tailwind CSS.
- PostgreSQL Supabase; Prisma ORM et migrations versionnées dans `prisma/migrations/`.
- Auth.js Credentials, bcrypt; Zod pour valider les entrées API.
- Supabase Storage privé pour les photos; la compression est faite dans le navigateur avant l’envoi.
- `npm run db:generate`, `npm run db:deploy`, `npm run db:seed`, `npm run typecheck`, `npm run lint`, `npm run build`.

## Étape suivante

Le produit livré couvre le MVP prioritaire décrit dans la demande. Les évolutions qui nécessitent un service/configuration distincte sont les notifications push Web, les e-mails d’invitation automatiques et un véritable export `.xlsx`; l’export livré est un CSV UTF‑8 compatible Excel.
