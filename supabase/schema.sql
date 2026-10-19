-- O Supabase Auth gerencia auth.users internamente. Não crie essa tabela manualmente.
-- Execute este arquivo no SQL Editor depois de executar oficina.sql.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome varchar(120),
  role varchar(20) not null default 'usuario' check (role in ('usuario', 'admin')),
  oficina_id integer references public.oficina(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Compatibilidade caso a tabela profiles já tenha sido criada pela versão anterior.
alter table public.profiles add column if not exists role varchar(20) not null default 'usuario';

alter table public.profiles enable row level security;
create policy "Usuários podem ver seu perfil" on public.profiles for select using (auth.uid() = id);
create policy "Usuários podem atualizar seu perfil" on public.profiles for update using (auth.uid() = id);
create policy "Usuários podem criar seu perfil" on public.profiles for insert with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, role) values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)), 'usuario');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Dados da aplicação: cada usuário autenticado pode operar as tabelas.
alter table public.oficina enable row level security;
alter table public.vendedor enable row level security;
alter table public.cliente enable row level security;
alter table public.veiculo enable row level security;
alter table public.orcamento enable row level security;
alter table public.orcamento_item enable row level security;
alter table public.recibo enable row level security;

create policy "Acesso autenticado oficina" on public.oficina for all to authenticated using (true) with check (true);
create policy "Acesso autenticado vendedor" on public.vendedor for all to authenticated using (true) with check (true);
create policy "Acesso autenticado cliente" on public.cliente for all to authenticated using (true) with check (true);
create policy "Acesso autenticado veiculo" on public.veiculo for all to authenticated using (true) with check (true);
create policy "Acesso autenticado orcamento" on public.orcamento for all to authenticated using (true) with check (true);
create policy "Acesso autenticado item" on public.orcamento_item for all to authenticated using (true) with check (true);
create policy "Acesso autenticado recibo" on public.recibo for all to authenticated using (true) with check (true);

-- O primeiro administrador pode ser promovido manualmente no SQL Editor:
-- update public.profiles set role = 'admin' where id = 'UUID_DO_USUARIO';
