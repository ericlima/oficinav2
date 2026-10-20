-- O Supabase Auth gerencia auth.users internamente. Não crie essa tabela manualmente.
-- Execute este arquivo no SQL Editor depois de executar oficina.sql.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome varchar(120),
  role varchar(20) not null default 'user' check (role in ('user', 'admin')),
  oficina_id integer references public.oficina(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Compatibilidade com instalações anteriores, que usavam "usuario" como role padrão.
alter table public.profiles add column if not exists role varchar(20) not null default 'user';
alter table public.profiles alter column role set default 'user';
alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'user' where role = 'usuario';
alter table public.profiles add constraint profiles_role_check check (role in ('user', 'admin'));

alter table public.profiles enable row level security;
drop policy if exists "Usuários podem ver seu perfil" on public.profiles;
drop policy if exists "Usuários podem atualizar seu perfil" on public.profiles;
drop policy if exists "Usuários podem criar seu perfil" on public.profiles;
drop policy if exists "Administra perfil" on public.profiles;
create policy "Usuários podem ver seu perfil" on public.profiles for select to authenticated using (auth.uid() = id);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, role) values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)), 'user');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Usuários autenticados podem consultar os dados; somente administradores podem alterá-los.
alter table public.oficina enable row level security;
alter table public.vendedor enable row level security;
alter table public.cliente enable row level security;
alter table public.veiculo enable row level security;
alter table public.orcamento enable row level security;
alter table public.orcamento_item enable row level security;
alter table public.recibo enable row level security;

drop policy if exists "Acesso autenticado oficina" on public.oficina;
drop policy if exists "Acesso autenticado vendedor" on public.vendedor;
drop policy if exists "Acesso autenticado cliente" on public.cliente;
drop policy if exists "Acesso autenticado veiculo" on public.veiculo;
drop policy if exists "Acesso autenticado orcamento" on public.orcamento;
drop policy if exists "Acesso autenticado item" on public.orcamento_item;
drop policy if exists "Acesso autenticado recibo" on public.recibo;
drop policy if exists "Leitura autenticada oficina" on public.oficina;
drop policy if exists "Administra oficina" on public.oficina;
drop policy if exists "Leitura autenticada vendedor" on public.vendedor;
drop policy if exists "Administra vendedor" on public.vendedor;
drop policy if exists "Leitura autenticada cliente" on public.cliente;
drop policy if exists "Administra cliente" on public.cliente;
drop policy if exists "Leitura autenticada veiculo" on public.veiculo;
drop policy if exists "Administra veiculo" on public.veiculo;
drop policy if exists "Leitura autenticada orcamento" on public.orcamento;
drop policy if exists "Administra orcamento" on public.orcamento;
drop policy if exists "Leitura autenticada item" on public.orcamento_item;
drop policy if exists "Administra item" on public.orcamento_item;
drop policy if exists "Leitura autenticada recibo" on public.recibo;
drop policy if exists "Administra recibo" on public.recibo;

create policy "Leitura autenticada oficina" on public.oficina for select to authenticated using (true);
create policy "Administra oficina" on public.oficina for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Leitura autenticada vendedor" on public.vendedor for select to authenticated using (true);
create policy "Administra vendedor" on public.vendedor for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Leitura autenticada cliente" on public.cliente for select to authenticated using (true);
create policy "Administra cliente" on public.cliente for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Leitura autenticada veiculo" on public.veiculo for select to authenticated using (true);
create policy "Administra veiculo" on public.veiculo for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Leitura autenticada orcamento" on public.orcamento for select to authenticated using (true);
create policy "Administra orcamento" on public.orcamento for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Leitura autenticada item" on public.orcamento_item for select to authenticated using (true);
create policy "Administra item" on public.orcamento_item for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Leitura autenticada recibo" on public.recibo for select to authenticated using (true);
create policy "Administra recibo" on public.recibo for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Crie contas em Authentication > Users; novas contas começam como user.
-- Promova o primeiro administrador manualmente no SQL Editor:
-- update public.profiles set role = 'admin' where id = 'UUID_DO_USUARIO';
