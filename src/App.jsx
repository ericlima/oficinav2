import React, { useEffect, useState } from 'react'
import { ArrowUpRight, CarFront, Check, ClipboardList, LayoutDashboard, LogOut, Menu, Moon, Plus, ReceiptText, Search, Settings, ShieldCheck, Sun, Users, Wrench, X, Trash2, Pencil } from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'

const today = new Date().toISOString().slice(0, 10)
const demoData = {
  oficina: { id: 1, nome: 'Baixinho Car', descricao: 'Serviços automotivos nacionais e importados' },
  clientes: [{ id: 1, nome: 'Mariana Costa', telefone: '(13) 99842-1150', veiculos: 2, criado_em: '2024-06-14' }, { id: 2, nome: 'Rafael Mendes', telefone: '(13) 99172-4033', veiculos: 1, criado_em: '2024-06-12' }, { id: 3, nome: 'Juliana Rocha', telefone: '(13) 99721-8801', veiculos: 1, criado_em: '2024-06-08' }],
  veiculos: [{ id: 1, cliente_id: 1, marca: 'Toyota', modelo: 'Corolla XEi', ano: 2021, placa: 'FTR-4A21', cor: 'Prata' }, { id: 2, cliente_id: 2, marca: 'Volkswagen', modelo: 'T-Cross Highline', ano: 2023, placa: 'GBA-8C04', cor: 'Cinza' }],
  orcamentos: [{ id: 1, numero: 1248, cliente_id: 1, cliente: 'Mariana Costa', veiculo_id: 1, veiculo: 'Toyota Corolla XEi', status: 'APROVADO', data: '2024-06-14', total_geral: 2480 }],
  recibos: [{ id: 1, numero: 421, orcamento_id: 1, cliente: 'Mariana Costa', orcamento: 1248, data_emissao: '2024-06-14', valor: 2480, forma_pagamento: 'PIX' }]
}
const menu = [{ id: 'dashboard', label: 'Visão geral', icon: LayoutDashboard }, { id: 'orcamentos', label: 'Orçamentos', icon: ClipboardList }, { id: 'clientes', label: 'Clientes', icon: Users }, { id: 'veiculos', label: 'Veículos', icon: CarFront }, { id: 'recibos', label: 'Recibos', icon: ReceiptText }]
const money = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0)
const date = (v) => v ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${v}T12:00:00`)).replace('.', '') : '—'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [profile, setProfile] = useState(null)
  const [appError, setAppError] = useState('')
  const [dataVersion, setDataVersion] = useState(0)
  const [theme, setTheme] = useState(() => localStorage.getItem('oficina-theme') || 'light')
  const [active, setActive] = useState('dashboard')
  const [search, setSearch] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [data, setData] = useState(demoData)
  const [modal, setModal] = useState(null)

  const isAdmin = profile?.role === 'admin'
  const displayName = profile?.nome || session?.user?.email || 'Usuário'

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('oficina-theme', theme)
  }, [theme])

  useEffect(() => {
    if (!supabase) return
    let active = true
    const { data: listener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!active) return
      setSession(currentSession)
      setProfile(null)
      setAppError('')
    })
    supabase.auth.getSession().then(({ data: result, error }) => {
      if (!active) return
      if (error) setAppError(`Não foi possível verificar a sessão: ${error.message}`)
      setSession(result.session)
      setLoading(false)
    }).catch(error => {
      if (active) {
        setAppError(`Não foi possível verificar a sessão: ${error.message}`)
        setLoading(false)
      }
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session || !supabase) return
    let active = true
    async function loadData() {
      try {
        const results = await Promise.all([
          supabase.from('oficina').select('*').limit(1).maybeSingle(),
          supabase.from('cliente').select('*').order('criado_em', { ascending: false }),
          supabase.from('veiculo').select('*').order('id', { ascending: false }),
          supabase.from('orcamento').select('*, cliente(nome), veiculo(marca, modelo)').order('data', { ascending: false }),
          supabase.from('recibo').select('*, orcamento(numero, cliente(nome))').order('data_emissao', { ascending: false }),
          supabase.from('profiles').select('nome, role').eq('id', session.user.id).maybeSingle()
        ])
        const failed = results.find(result => result.error)
        if (failed) throw failed.error
        const [office, clients, cars, quotes, receipts, profileResult] = results
        if (!profileResult.data) throw new Error('O perfil deste usuário não foi encontrado. Execute o script supabase/schema.sql.')
        if (!['admin', 'user'].includes(profileResult.data.role)) throw new Error('O perfil possui um nível de acesso inválido.')
        if (!active) return
        setData({
          oficina: office.data || demoData.oficina,
          clientes: clients.data || [],
          veiculos: cars.data || [],
          orcamentos: (quotes.data || []).map(quote => ({
            ...quote,
            cliente: quote.cliente?.nome || 'Sem cliente',
            veiculo: quote.veiculo ? `${quote.veiculo.marca} ${quote.veiculo.modelo}` : 'Sem veículo'
          })),
          recibos: (receipts.data || []).map(receipt => ({
            ...receipt,
            orcamento: receipt.orcamento?.numero || receipt.orcamento_id,
            cliente: receipt.orcamento?.cliente?.nome || 'Sem cliente'
          }))
        })
        setProfile(profileResult.data)
        setAppError('')
      } catch (error) {
        if (active) {
          const missingProfiles = error.code === 'PGRST205' || error.code === '42P01' || error.message?.includes("public.profiles")
          setAppError(missingProfiles
            ? 'A tabela public.profiles ainda não existe no Supabase. No SQL Editor do projeto, execute o arquivo supabase/schema.sql. Se já executou, atualize o cache da API com NOTIFY pgrst, \'reload schema\'; e tente novamente.'
            : `Não foi possível carregar os dados: ${error.message}`)
        }
      }
    }
    loadData()
    return () => { active = false }
  }, [session, dataVersion])

  async function save(type, form, editing) {
    if (!isAdmin) return
    const key = type === 'cliente' ? 'clientes' : `${type}s`
    const id = editing?.id || Date.now()
    let item
    if (type === 'cliente') item = { ...form, id, criado_em: editing?.criado_em || today }
    if (type === 'veiculo') item = { ...form, id, ano: Number(form.ano) || null }
    if (type === 'orcamento') {
      const client = data.clientes.find(value => String(value.id) === String(form.cliente_id))
      const car = data.veiculos.find(value => String(value.id) === String(form.veiculo_id))
      item = { ...form, id, numero: editing?.numero || Math.max(0, ...data.orcamentos.map(value => Number(value.numero) || 0)) + 1, cliente: client?.nome || 'Sem cliente', veiculo: car ? `${car.marca} ${car.modelo}` : 'Sem veículo', total_geral: Number(form.total_geral) || 0 }
    }
    if (type === 'recibo') {
      const quote = data.orcamentos.find(value => String(value.id) === String(form.orcamento_id))
      item = { ...form, id, numero: editing?.numero || Math.max(0, ...data.recibos.map(value => Number(value.numero) || 0)) + 1, cliente: quote?.cliente || 'Sem cliente', orcamento: quote?.numero || form.orcamento_id, valor: Number(form.valor) || 0 }
    }
    if (supabase && session) {
      const payload = { ...form }
      ;['id', 'numero', 'cliente', 'veiculo', 'orcamento', 'criado_em'].forEach(keyToRemove => delete payload[keyToRemove])
      if (type === 'orcamento') payload.oficina_id = data.oficina.id
      const result = editing ? await supabase.from(type).update(payload).eq('id', editing.id) : await supabase.from(type).insert(payload)
      if (result.error) return window.alert(`Não foi possível guardar: ${result.error.message}`)
      setModal(null)
      setDataVersion(version => version + 1)
    } else {
      setData(currentData => ({ ...currentData, [key]: editing ? currentData[key].map(value => value.id === id ? item : value) : [item, ...currentData[key]] }))
      setModal(null)
    }
  }

  async function remove(type, item) {
    if (!isAdmin || !window.confirm('Deseja realmente eliminar este registro?')) return
    const key = type === 'cliente' ? 'clientes' : `${type}s`
    if (supabase && session) {
      const result = await supabase.from(type).delete().eq('id', item.id)
      if (result.error) return window.alert(`Não foi possível eliminar: ${result.error.message}`)
      setData(currentData => ({ ...currentData, [key]: currentData[key].filter(value => value.id !== item.id) }))
    } else {
      setData(currentData => ({ ...currentData, [key]: currentData[key].filter(value => value.id !== item.id) }))
    }
  }

  async function logout() {
    const { error } = await supabase.auth.signOut()
    if (error) setAppError(`Não foi possível encerrar a sessão: ${error.message}`)
  }

  if (loading || (session && !profile && !appError)) return <div className="loading-screen">Carregando sua oficina…</div>
  if (!isSupabaseConfigured) return <AuthUnavailableScreen />
  if (appError) return <AuthErrorScreen message={appError} onLogout={logout} />
  if (!session) return <AuthScreen />

  const current = menu.find(item => item.id === active)
  const type = active === 'orcamentos' ? 'orcamento' : active === 'clientes' ? 'cliente' : active === 'veiculos' ? 'veiculo' : active === 'recibos' ? 'recibo' : null
  const rows = type ? data[`${type}s`].filter(item => JSON.stringify(item).toLowerCase().includes(search.toLowerCase())) : []
  const initials = displayName.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()

  return <div className={`app-shell ${isAdmin ? '' : 'user-view'}`}>
    <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div className="brand"><span className="brand-mark"><Wrench size={20} /></span><div><strong>Baixinho</strong><small>CAR</small></div><button className="mobile-close" onClick={() => setSidebarOpen(false)}><X size={18} /></button></div>
      <div className="workshop-label">GESTÃO DE OFICINA</div>
      <nav>{menu.map(({ id, label, icon: Icon }) => <button key={id} className={active === id ? 'active' : ''} onClick={() => { setActive(id); setSearch(''); setSidebarOpen(false) }}><Icon size={18} />{label}</button>)}</nav>
      <div className="sidebar-bottom"><button onClick={() => setActive('configuracoes')}><Settings size={18} />Configurações</button><div className="security-note"><ShieldCheck size={16} />Seus dados estão protegidos</div></div>
    </aside>
    <main className="main-content">
      <header className="topbar">
        <button className="menu-trigger" onClick={() => setSidebarOpen(true)}><Menu /></button>
        <div className="breadcrumb"><span>Oficina</span><strong>/</strong><b>{current?.label || 'Configurações'}</b></div>
        <div className="top-actions">
          <button className="icon-button" aria-label="Alternar tema" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}</button>
          <div className="user-menu"><span className="avatar">{initials}</span><div className="user-text"><b>{displayName}</b><small>{isAdmin ? 'Administrador' : 'Usuário'}</small></div></div>
          <button className="logout-button" onClick={logout}><LogOut size={17} /><span>Sair</span></button>
        </div>
      </header>
      <div className="page-content">
        {active === 'dashboard'
          ? <Dashboard data={data} name={displayName} canManage={isAdmin} onNew={() => setModal({ type: 'orcamento' })} />
          : active === 'configuracoes'
            ? <SettingsPage theme={theme} setTheme={setTheme} />
            : <DataPage title={current.label} type={type} search={search} setSearch={setSearch} canManage={isAdmin} onNew={() => setModal({ type })}>
              {type === 'cliente'
                ? <ClientsTable rows={rows} onEdit={item => setModal({ type, item })} onDelete={item => remove(type, item)} />
                : type === 'veiculo'
                  ? <CarsTable rows={rows} clients={data.clientes} onEdit={item => setModal({ type, item })} onDelete={item => remove(type, item)} />
                  : type === 'orcamento'
                    ? <QuotesTable rows={rows} onEdit={item => setModal({ type, item })} onDelete={item => remove(type, item)} />
                    : <ReceiptsTable rows={rows} onEdit={item => setModal({ type, item })} onDelete={item => remove(type, item)} />}
            </DataPage>}
      </div>
      {modal && isAdmin && <CrudModal type={modal.type} item={modal.item} data={data} onClose={() => setModal(null)} onSave={save} />}
    </main>
  </div>
}

function Dashboard({ data, name, canManage, onNew }) { return <><section className="welcome"><div><p className="eyebrow">GESTÃO DE OFICINA</p><h1>Olá, {name.split(/\s+/)[0]} <span>✦</span></h1><p>Controle os registros da sua oficina.</p></div>{canManage && <button className="primary-button" onClick={onNew}><Plus size={18} />Novo orçamento</button>}</section><section className="stats-grid"><StatCard icon={Users} label="Clientes cadastrados" value={data.clientes.length} /><StatCard icon={CarFront} label="Veículos cadastrados" value={data.veiculos.length} /><StatCard icon={ClipboardList} label="Orçamentos" value={data.orcamentos.length} /><StatCard icon={ReceiptText} label="Recibos emitidos" value={data.recibos.length} /></section><section className="panel quotes-panel"><div className="panel-heading"><div><h2>Orçamentos recentes</h2><p>{canManage ? 'Use os menus para criar, editar e eliminar registros.' : 'Visualize os orçamentos recentes da sua oficina.'}</p></div></div><QuotesTable rows={data.orcamentos.slice(0, 5)} /></section></> }
function StatCard({ icon: Icon, label, value }) { return <div className="stat-card"><div className="stat-icon blue"><Icon size={19} /></div><p>{label}</p><strong>{value}</strong></div> }
function DataPage({ title, type, search, setSearch, canManage, onNew, children }) { const labels = { cliente: 'cliente', veiculo: 'veículo', orcamento: 'orçamento', recibo: 'recibo' }; return <><section className="page-heading"><div><div className="title-icon"><ClipboardList size={20} /></div><h1>{title}</h1><p>{canManage ? 'Gerencie os registros da sua oficina.' : 'Consulte os registros da sua oficina.'}</p></div>{canManage && <button className="primary-button" onClick={onNew}><Plus size={18} />Novo {labels[type]}</button>}</section><div className="toolbar"><div className="search-box"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={`Buscar em ${title.toLowerCase()}…`} /></div></div><section className="panel table-panel">{children}</section></> }
function Actions({ row, onEdit, onDelete }) { return <td><div className="row-actions"><button className="row-action" title="Editar" onClick={() => onEdit(row)}><Pencil size={14} /></button><button className="row-action danger" title="Eliminar" onClick={() => onDelete(row)}><Trash2 size={14} /></button></div></td> }
function QuotesTable({ rows, onEdit = () => {}, onDelete = () => {} }) { return <div className="table-wrap"><table><thead><tr><th>NÚMERO</th><th>CLIENTE</th><th>VEÍCULO</th><th>DATA</th><th>STATUS</th><th className="align-right">TOTAL</th><th /></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td><b className="table-number">#{r.numero}</b></td><td>{r.cliente}</td><td>{r.veiculo}</td><td>{date(r.data)}</td><td><span className={`status ${(r.status || '').toLowerCase()}`}>{r.status}</span></td><td className="align-right"><b>{money(r.total_geral)}</b></td><Actions row={r} onEdit={onEdit} onDelete={onDelete} /></tr>)}</tbody></table>{!rows.length && <Empty />}</div> }
function ReceiptsTable({ rows, onEdit, onDelete }) { return <div className="table-wrap"><table><thead><tr><th>NÚMERO</th><th>CLIENTE</th><th>ORÇAMENTO</th><th>EMISSÃO</th><th>PAGAMENTO</th><th className="align-right">VALOR</th><th /></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td><b className="table-number">#{r.numero}</b></td><td>{r.cliente}</td><td>#{r.orcamento}</td><td>{date(r.data_emissao)}</td><td>{r.forma_pagamento}</td><td className="align-right"><b>{money(r.valor)}</b></td><Actions row={r} onEdit={onEdit} onDelete={onDelete} /></tr>)}</tbody></table>{!rows.length && <Empty />}</div> }
function ClientsTable({ rows, onEdit, onDelete }) { return <div className="table-wrap"><table><thead><tr><th>CLIENTE</th><th>TELEFONE</th><th>CADASTRO</th><th /></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td><b>{r.nome}</b></td><td>{r.telefone || '—'}</td><td>{date(r.criado_em)}</td><Actions row={r} onEdit={onEdit} onDelete={onDelete} /></tr>)}</tbody></table>{!rows.length && <Empty />}</div> }
function CarsTable({ rows, clients, onEdit, onDelete }) { return <div className="table-wrap"><table><thead><tr><th>VEÍCULO</th><th>PROPRIETÁRIO</th><th>PLACA</th><th>ANO</th><th /></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td><div className="car-cell"><CarFront size={18} /><b>{r.marca} {r.modelo}</b></div></td><td>{clients.find(c => c.id === r.cliente_id)?.nome || '—'}</td><td>{r.placa || '—'}</td><td>{r.ano || '—'}</td><Actions row={r} onEdit={onEdit} onDelete={onDelete} /></tr>)}</tbody></table>{!rows.length && <Empty />}</div> }
function Empty() { return <div className="empty">Nenhum registro encontrado.</div> }

function CrudModal({ type, item, data, onClose, onSave }) { const initial = type === 'cliente' ? { nome: '', telefone: '', cpf: '' } : type === 'veiculo' ? { cliente_id: '', marca: '', modelo: '', ano: '', placa: '', cor: '' } : type === 'orcamento' ? { cliente_id: '', veiculo_id: '', data: today, status: 'ABERTO', km: '', total_geral: '' } : { orcamento_id: '', data_emissao: today, valor: '', forma_pagamento: 'PIX' }; const [form, setForm] = useState({ ...initial, ...item }); const update = (k, v) => setForm(f => ({ ...f, [k]: v })); const title = `${item ? 'Editar' : 'Novo'} ${type === 'cliente' ? 'cliente' : type === 'veiculo' ? 'veículo' : type === 'orcamento' ? 'orçamento' : 'recibo'}`; return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e => e.stopPropagation()}><form onSubmit={e => { e.preventDefault(); onSave(type, form, item) }}><div className="modal-header"><div><p className="eyebrow">CRUD</p><h2>{title}</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={18} /></button></div><div className="modal-grid">{type === 'cliente' && <><Field label="Nome" value={form.nome} onChange={v => update('nome', v)} required /><Field label="Telefone" value={form.telefone} onChange={v => update('telefone', v)} /><Field label="CPF" value={form.cpf} onChange={v => update('cpf', v)} /></>}{type === 'veiculo' && <><SelectField label="Cliente" value={form.cliente_id} onChange={v => update('cliente_id', v)} options={data.clientes.map(x => [x.id, x.nome])} required /><Field label="Marca" value={form.marca} onChange={v => update('marca', v)} required /><Field label="Modelo" value={form.modelo} onChange={v => update('modelo', v)} required /><Field label="Ano" type="number" value={form.ano} onChange={v => update('ano', v)} /><Field label="Placa" value={form.placa} onChange={v => update('placa', v)} /><Field label="Cor" value={form.cor} onChange={v => update('cor', v)} /></>}{type === 'orcamento' && <><SelectField label="Cliente" value={form.cliente_id} onChange={v => update('cliente_id', v)} options={data.clientes.map(x => [x.id, x.nome])} required /><SelectField label="Veículo" value={form.veiculo_id} onChange={v => update('veiculo_id', v)} options={data.veiculos.map(x => [x.id, `${x.marca} ${x.modelo}`])} required /><Field label="Data" type="date" value={form.data} onChange={v => update('data', v)} required /><SelectField label="Status" value={form.status} onChange={v => update('status', v)} options={['ABERTO', 'APROVADO', 'RECUSADO', 'CONCLUIDO'].map(x => [x, x])} /><Field label="Total" type="number" value={form.total_geral} onChange={v => update('total_geral', v)} /><Field label="Quilometragem" type="number" value={form.km} onChange={v => update('km', v)} /></>}{type === 'recibo' && <><SelectField label="Orçamento" value={form.orcamento_id} onChange={v => update('orcamento_id', v)} options={data.orcamentos.map(x => [x.id, `#${x.numero} · ${x.cliente}`])} required /><SelectField label="Pagamento" value={form.forma_pagamento} onChange={v => update('forma_pagamento', v)} options={['PIX', 'Dinheiro', 'Cartão de crédito', 'Cartão de débito'].map(x => [x, x])} /><Field label="Valor" type="number" value={form.valor} onChange={v => update('valor', v)} required /><Field label="Data" type="date" value={form.data_emissao} onChange={v => update('data_emissao', v)} required /></>}</div><div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" type="submit">Guardar <Check size={16} /></button></div></form></div></div> }
function Field({ label, value, onChange, type = 'text', required }) { return <label>{label}<input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} required={required} /></label> }
function SelectField({ label, value, onChange, options, required }) { return <label>{label}<select value={value ?? ''} onChange={e => onChange(e.target.value)} required={required}><option value="">Selecione</option>{options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select></label> }
function AuthScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  async function submit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
      if (loginError) setError(loginError.message)
    } catch (loginError) {
      setError(`Não foi possível entrar: ${loginError.message}`)
    } finally {
      setSubmitting(false)
    }
  }
  return <div className="auth-screen"><AuthArtwork /><div className="auth-form-wrap"><div className="auth-form"><p className="eyebrow">BAIXINHO CAR</p><h1>Acesse sua oficina</h1><p className="auth-subtitle">Entre com seu e-mail e senha para continuar.</p><form onSubmit={submit}><label>E-mail<input type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required /></label><label>Senha<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label>{error && <div className="form-error">{error}</div>}<button className="primary-button full" disabled={submitting}>{submitting ? 'Entrando…' : 'Entrar'}</button></form></div></div></div>
}
function AuthArtwork() { return <section className="auth-art"><div className="auth-brand"><span className="brand-mark"><Wrench size={20} /></span><b>Baixinho <span>CAR</span></b></div><div className="art-copy"><p className="eyebrow">GESTÃO DE OFICINA</p><h1>Organize sua oficina.<br /><em>Atenda melhor.</em></h1><p>Acompanhe clientes, veículos, orçamentos e recibos em um só lugar.</p></div><div className="art-footer"><span>Acesso seguro à sua oficina</span><span><ShieldCheck size={14} /> Dados protegidos</span></div></section> }
function AuthUnavailableScreen() { return <div className="auth-screen"><AuthArtwork /><div className="auth-form-wrap"><div className="auth-form"><p className="eyebrow">BAIXINHO CAR</p><h1>Configure o acesso</h1><p className="auth-subtitle">Para entrar com segurança, configure as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env e execute o script supabase/schema.sql no Supabase.</p></div></div></div> }
function AuthErrorScreen({ message, onLogout }) { return <div className="auth-screen"><AuthArtwork /><div className="auth-form-wrap"><div className="auth-form"><p className="eyebrow">BAIXINHO CAR</p><h1>Não foi possível abrir sua oficina</h1><p className="auth-subtitle form-error">{message}</p><button className="secondary-button" onClick={onLogout}>Voltar para o login</button></div></div></div> }
function SettingsPage({ theme, setTheme }) { return <section className="settings-page"><div className="page-heading"><div><div className="title-icon"><Settings size={20} /></div><h1>Configurações</h1></div></div><div className="panel settings-panel"><div><h2>Aparência</h2><p>Escolha como a aplicação deve ser exibida.</p></div><div className="theme-options"><button className={theme === 'light' ? 'selected' : ''} onClick={() => setTheme('light')}><Sun size={20} />Modo claro</button><button className={theme === 'dark' ? 'selected' : ''} onClick={() => setTheme('dark')}><Moon size={20} />Modo escuro</button></div></div></section> }
export default App
