import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

export default function AgentDashboard() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [clients, setClients] = useState([]);
  const [activeClientId, setActiveClientId] = useState(null);
  const [docTypes, setDocTypes] = useState([]);
  const [clientDocs, setClientDocs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push('/agent/login');
      } else {
        setSession(data.session);
      }
    });
  }, [router]);

  useEffect(() => {
    if (!session) return;
    loadClients();
    loadDocTypes();
  }, [session]);

  useEffect(() => {
    if (activeClientId) {
      loadClientDocs(activeClientId);
      loadNotifications(activeClientId);
    }
  }, [activeClientId]);

  async function loadClients() {
    const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
    setClients(data || []);
    if (data && data.length > 0 && !activeClientId) setActiveClientId(data[0].id);
  }

  async function loadDocTypes() {
    const { data } = await supabase.from('document_types').select('*').order('sort_order');
    setDocTypes(data || []);
  }

  async function loadClientDocs(clientId) {
    const { data } = await supabase.from('client_documents').select('*').eq('client_id', clientId);
    setClientDocs(data || []);
  }

  async function loadNotifications(clientId) {
    const { data } = await supabase.from('notifications').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(15);
    setNotifications(data || []);
  }

  async function addClient(e) {
    e.preventDefault();
    if (!newName || !newEmail) return;
    const { data: client, error } = await supabase.from('clients').insert({ full_name: newName, email: newEmail }).select().single();
    if (error) { alert(error.message); return; }
    const rows = docTypes.map(dt => ({ client_id: client.id, document_type_id: dt.id, status: 'missing' }));
    await supabase.from('client_documents').insert(rows);
    setNewName(''); setNewEmail('');
    await loadClients();
    setActiveClientId(client.id);
  }

  async function toggleDoc(clientDocId, currentStatus) {
    const newStatus = currentStatus === 'received' ? 'missing' : 'received';
    await supabase.from('client_documents').update({ status: newStatus, received_at: newStatus === 'received' ? new Date().toISOString() : null }).eq('id', clientDocId);
    loadClientDocs(activeClientId);
  }

  async function requestDoc(clientDocId, docTitle) {
    await supabase.from('client_documents').update({ status: 'requested', requested_at: new Date().toISOString() }).eq('id', clientDocId);
    await supabase.from('notifications').insert({ client_id: activeClientId, title: `Request logged: ${docTitle}`, body: `Marked as requested from client.` });
    loadClientDocs(activeClientId);
    loadNotifications(activeClientId);
  }

  async function sendToLender() {
    await supabase.from('clients').update({ status: 'sent_to_lender' }).eq('id', activeClientId);
    await supabase.from('notifications').insert({ client_id: activeClientId, title: 'File transmitted', body: 'Complete case file sent to the carrier and financing lender for approval.' });
    loadClients();
    loadNotifications(activeClientId);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push('/agent/login');
  }

  const activeClient = clients.find(c => c.id === activeClientId);
  const merged = docTypes.map(dt => {
    const cd = clientDocs.find(d => d.document_type_id === dt.id);
    return { ...dt, clientDocId: cd?.id, status: cd?.status || 'missing' };
  });
  const receivedCount = merged.filter(m => m.status === 'received').length;
  const allReceived = docTypes.length > 0 && receivedCount === docTypes.length;

  if (!session) return null;

  return (
    <div className="app-shell">
      <div className="sidebar">
        <div className="brand">
          <div className="mark">Ledger</div>
          <div className="sub">Case file portal</div>
        </div>
        <div>
          {clients.map(c => (
            <div key={c.id} className={`client-item ${c.id === activeClientId ? 'active' : ''}`} onClick={() => setActiveClientId(c.id)}>
              <div className="name">{c.full_name}</div>
              <div className="status">{c.status.replace(/_/g, ' ')}</div>
            </div>
          ))}
        </div>
        <form className="add-client-form" onSubmit={addClient}>
          <input placeholder="Client name" value={newName} onChange={e => setNewName(e.target.value)} />
          <input placeholder="Client email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
          <button type="submit">+ Add client file</button>
        </form>
      </div>

      <div className="main">
        <div className="topbar">
          <div>
            <h1 className="case-title">{activeClient ? activeClient.full_name : 'No clients yet'}</h1>
            {activeClient && <div className="case-meta">{activeClient.email}</div>}
          </div>
          <span className="logout-link" onClick={logout}>Sign out</span>
        </div>

        {activeClient && (
          <>
            <div className="ledger">
              {merged.map(doc => (
                <div className="ledger-row" key={doc.id}>
                  <div className={`stamp ${doc.status === 'received' ? 'received' : 'missing'}`}>{doc.status === 'received' ? '✓' : '!'}</div>
                  <div className="doc-name">
                    <div className="title">{doc.name}{doc.is_restricted && <span className="badge-restricted">Restricted</span>}</div>
                    <div className="desc">{doc.description}</div>
                  </div>
                  {doc.status === 'received' ? (
                    <button className="action-btn" onClick={() => toggleDoc(doc.clientDocId, doc.status)}>Mark outstanding</button>
                  ) : (
                    <>
                      <button className="action-btn" onClick={() => toggleDoc(doc.clientDocId, doc.status)} style={{ marginRight: 6 }}>Mark received</button>
                      <button className="action-btn primary" onClick={() => requestDoc(doc.clientDocId, doc.name)}>Request</button>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}><b>{receivedCount} of {docTypes.length}</b> documents on file</div>
              <button className="action-btn primary" disabled={!allReceived || activeClient.status === 'sent_to_lender'} onClick={sendToLender}>
                {activeClient.status === 'sent_to_lender' ? 'Sent to carrier & lender ✓' : 'Send file to carrier & lender'}
              </button>
            </div>

            <div className="notif-feed">
              <h3>Activity</h3>
              {notifications.length === 0 && <p style={{ color: 'var(--ink-soft)', fontSize: 12.5 }}>No activity yet on this file.</p>}
              {notifications.map(n => (
                <div className="notif-item" key={n.id}>
                  <div><b>{n.title}</b></div>
                  <div>{n.body}</div>
                  <div className="time">{new Date(n.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
