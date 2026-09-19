-- Politiques Row Level Security (RLS) Supabase — à exécuter une fois via l'éditeur SQL
-- Supabase, en complément du schéma Prisma. Prisma ne gère pas la RLS.
--
-- Principe : le serveur applicatif se connecte avec un seul rôle Postgres (pas un rôle
-- par boutique), donc l'isolation ne peut pas reposer sur le rôle de connexion. À la
-- place, chaque requête doit fixer une variable de session `app.current_shop` au début
-- de la transaction, et les politiques RLS ci-dessous filtrent dessus. C'est un filet
-- de sécurité en plus du filtrage applicatif (WHERE shopDomain = ...) documenté dans
-- docs/phase-2-architecture.md — si le code applicatif oublie un filtre, la base refuse
-- quand même de renvoyer les lignes d'une autre boutique.

alter table "Boutique" enable row level security;
alter table "LigneLivre" enable row level security;

create policy boutique_isolee_par_shop
  on "Boutique"
  using ("shopDomain" = current_setting('app.current_shop', true));

create policy ligne_livre_isolee_par_shop
  on "LigneLivre"
  using ("shopDomain" = current_setting('app.current_shop', true));

-- Côté application, avant toute requête Prisma sur ces tables, dans la même transaction :
--   await tx.$executeRawUnsafe(`SELECT set_config('app.current_shop', $1, true)`, shopDomain);
-- `true` (le 3e argument de set_config) rend le réglage local à la transaction : il ne
-- fuit jamais vers une autre requête concurrente sur la même connexion poolée.
