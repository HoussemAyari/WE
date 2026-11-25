# DeuxNous — budget et préparatifs à deux

Application française mobile-first pour tenir le budget du foyer, préparer le mariage et le logement, recueillir les avis des deux partenaires et discuter ensemble.

## Plan produit et architecture

### Modèle de données

- **User / AuthAccount / AuthSession / AuthVerification / AuthRateLimit** : Better Auth avec adaptateur Prisma; bcrypt est appelé par Better Auth pour le stockage et la vérification des mots de passe, les sessions sont persistées et renouvelées, et les vérifications, réinitialisations et limites de tentatives sont gérées par le module.
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

1. Dans le tableau de bord Supabase, créez un nouveau projet nommé par exemple `deuxnous-prod`; ne choisissez pas une base existante. Vérifiez que le Project Ref `ofmpmilantcvqkonzkns` indiqué dans `.env.example` correspond bien à ce nouveau projet; sinon, remplacez-le. Copiez le Project URL et générez une nouvelle clé serveur après avoir révoqué celle qui a été exposée.
2. Dans **Storage**, créez le bucket `deuxnous-private` et laissez l’option **Public** désactivée. Ne créez aucune règle publique. L’application utilise la clé de service uniquement côté serveur et vérifie le membre avant chaque upload et téléchargement.
3. Dans Supabase, ouvrez **Connect → Connection string** et sélectionnez **Transaction pooler** pour `DATABASE_URL`; choisissez **Session pooler** pour `DIRECT_URL` si la connexion directe indiquée dans `.env.example` n’est pas accessible. Le mot de passe PostgreSQL est celui défini à la création du projet; si vous l’avez oublié, réinitialisez-le sous **Project Settings → Database**. Encodez les caractères spéciaux du mot de passe dans les URI. Configurez le client Google OAuth et Resend comme décrit plus bas, puis copiez `.env.example` vers `.env.local`. Configurez aussi les valeurs Supabase et créez des secrets distincts pour `AUTH_SECRET` et `CRON_SECRET` :

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

5. Ouvrez <http://localhost:3000/inscription>, créez le premier compte et vérifiez l’adresse depuis l’e-mail reçu. Connectez-vous, puis allez dans **Notre foyer → Générer le lien** et partagez l’invitation à votre partenaire. Le lien peut être limité à son adresse e-mail.

Données de démonstration facultatives, uniquement sur une base de développement jetable. Créez et vérifiez d’abord un compte de développement via Better Auth, puis indiquez son adresse :

```powershell
$env:DEMO_USER_EMAIL = "votre-adresse-verifiee@exemple.tn"
npm run db:seed
```

Le seed ajoute les données de démonstration au foyer de ce compte et ne crée ni ne hache de mot de passe. Ne lancez pas ce seed en production.

## Déploiement d’un nouveau projet Vercel

1. Publiez le contenu de `mariage-app/` dans un **nouveau dépôt Git** dédié, puis dans Vercel choisissez **Add New → Project** et importez ce dépôt. Le Root Directory est la racine du dépôt (`./`). Ne reliez pas l’ancien projet Vercel et ne recopiez aucune de ses variables.
2. Dans Supabase, utilisez le projet neuf créé pour DeuxNous. La connexion poolée `DATABASE_URL` (port 6543) sert aux requêtes de l’application; `DIRECT_URL` utilise de préférence le pooler Session (port 5432) pour les migrations. Configurez les URI depuis **Connect → Connection string** plutôt que de reprendre celles d’un autre projet. Si le mot de passe contient des caractères spéciaux, encodez-les dans l’URL.
3. Depuis **Project → Settings → Environment Variables** dans le nouveau projet Vercel, ajoutez `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` et `CRON_SECRET`. Ne préfixez aucune clé secrète par `NEXT_PUBLIC_`. Limitez les valeurs aux environnements nécessaires.
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

### Identifiants Google OAuth

1. Dans [Google Cloud Console](https://console.cloud.google.com/), créez ou sélectionnez un projet dédié à DeuxNous. Dans **Google Auth Platform → Branding**, renseignez le nom de l’application, l’e-mail d’assistance et l’adresse de contact développeur.
2. Dans **Google Auth Platform → Audience**, choisissez **External** si les deux partenaires ont des comptes Google personnels. Tant que l’application est en mode **Testing**, ajoutez les deux adresses à la liste **Test users**. Publiez l’application si elle doit accepter d’autres utilisateurs.
3. Dans **Google Auth Platform → Data Access**, conservez les portées `openid`, `email` et `profile` seulement.
4. Dans **Clients → Create client → Web application**, ajoutez les origines JavaScript autorisées `http://localhost:3000` et `https://<votre-domaine-vercel>`.
5. Ajoutez exactement ces URI de redirection autorisées :

   ```text
   http://localhost:3000/api/auth/callback/google
   https://<votre-domaine-vercel>/api/auth/callback/google
   ```

   Pour un domaine personnalisé, ajoutez également `https://<votre-domaine-personnalise>/api/auth/callback/google`. Copiez l’ID client et le secret client dans `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`; ne les publiez jamais dans le dépôt. Better Auth gère le flux OAuth, `state` et PKCE.
6. Dans un compte Resend neuf ou dédié, vérifiez un domaine d’envoi puis créez une clé API. Configurez `RESEND_API_KEY` et `EMAIL_FROM` avec une adresse de ce domaine pour que les liens de vérification et de réinitialisation soient délivrés.

## Variables d’environnement

Voir [.env.example](./.env.example). Configurez `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` et, en production, `CRON_SECRET`. `.env*` est ignoré par Git, sauf le fichier modèle `.env.example`. `AUTH_URL` vaut `http://localhost:3000` localement puis l’URL HTTPS canonique du nouveau déploiement.

Better Auth exige la vérification de l’adresse avant une connexion par mot de passe. Les liens d’e-mail expirent après une heure. Les cookies sont httpOnly, `SameSite=Lax`, `Secure` en production; les sessions durent 30 jours et sont renouvelées quotidiennement. Le rate limiting des connexions, inscriptions et demandes de réinitialisation est stocké en base. Les comptes Google déjà associés à une adresse vérifiée sont automatiquement liés; l’e-mail local doit être vérifié avant liaison pour prévenir la prise de contrôle d’un compte pré-enregistré.

## Vérification de livraison

### Automatique

```powershell
npm run typecheck
npm run lint
npm run build
```

### Parcours à tester après le déploiement

- [ ] Créer deux comptes distincts; inviter le second depuis le premier; vérifier qu’un foyer ne dépasse jamais deux membres.
- [ ] Vérifier la validation e-mail, la connexion Google, la liaison Google à un compte e-mail déjà vérifié et la réinitialisation du mot de passe.
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
- Better Auth avec adaptateur Prisma, connexion e-mail/mot de passe bcrypt, vérification e-mail, réinitialisation, OAuth Google, CSRF natif, sessions httpOnly et rate limiting persistant.
- Envoi des e-mails de compte par Resend; Google OAuth gère `state` et PKCE dans Better Auth.
- Supabase Storage privé pour les photos; la compression est faite dans le navigateur avant l’envoi.
- `npm run db:generate`, `npm run db:deploy`, `npm run db:seed`, `npm run typecheck`, `npm run lint`, `npm run build`.

## Étape suivante

Le produit livré couvre le MVP prioritaire décrit dans la demande. Les évolutions qui nécessitent un service/configuration distincte sont les notifications push Web, les e-mails d’invitation automatiques et un véritable export `.xlsx`; l’export livré est un CSV UTF‑8 compatible Excel.
