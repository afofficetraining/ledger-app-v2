import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import JSZip from 'jszip';

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
  const [downloading, setDownloading] = useState(false);
  const [nw, setNw] = useState({ stated: '', realEstate: '', liquidity: '' });
  const [pulling, setPulling] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/agent/login'); else setSession(data.session);
    });
  }, [router]);

  useEffect(() => { if (session) { loadClients(); loadDocTypes(); } }, [session]);
  useEffect(() => { if (activeClientId) { loadClientDocs(activeClientId); loadNotifications(activeClientId); loadNw(activeClientId); } }, [activeClientId]);

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
  function loadNw(clientId) {
    const c = clients.find(c => c.id === clientId);
    setNw({ stated: c?.stated_net_worth ?? '', realEstate: c?.real_estate_value ?? '', liquidity: c?.liquidity_value ?? '' });
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
    loadClientDocs(activeClientId); loadNotifications(activeClientId);
  }
  async function sendToLender() {
    await supabase.from('clients').update({ status: 'sent_to_lender' }).eq('id', activeClientId);
    await supabase.from('notifications').insert({ client_id: activeClientId, title: 'File transmitted', body: 'Complete case file sent to the carrier and financing lender for approval.' });
    loadClients(); loadNotifications(activeClientId);
  }
  async function downloadAllDocs() {
    if (!activeClient) return;
    setDownloading(true);
    try {
      const { data: docs } = await supabase.from('client_documents').select('*, document_types(name)').eq('client_id', activeClient.id);
      const zip = new JSZip();
      let fileCount = 0;
      for (const cd of docs || []) {
        const { data: files } = await supabase.from('document_files').select('*').eq('client_document_id', cd.id).order('uploaded_at', { ascending: false }).limit(1);
        const file = files && files[0];
        if (!file) continue;
        const { data: downloaded, error } = await supabase.storage.from('documents').download(file.storage_path);
        if (error || !downloaded) continue;
        const safeName = (cd.document_types?.name || 'document').replace(/[^a-z0-9]+/gi, '_');
        zip.file(`${safeName}_${file.original_filename}`, downloaded);
        fileCount++;
      }
      if (fileCount === 0) {
        alert('No documents have been uploaded for this client yet.');
        setDownloading(false);
        return;
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeClient.full_name.replace(/[^a-z0-9]+/gi, '_')}_case_file.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  async function logout() { await supabase.auth.signOut(); router.push('/agent/login'); }

  async function saveNw() {
    await supabase.from('clients').update({
      stated_net_worth: nw.stated === '' ? null : Number(nw.stated),
      real_estate_value: nw.realEstate === '' ? null : Number(nw.realEstate),
      liquidity_value: nw.liquidity === '' ? null : Number(nw.liquidity),
    }).eq('id', activeClientId);
    loadClients();
  }

  function nwCheck() {
    const stated = Number(nw.stated), re = Number(nw.realEstate), liq = Number(nw.liquidity);
    if (!nw.stated || (!nw.realEstate && !nw.liquidity)) return null;
    const combined = re + liq;
    const diff = Math.abs(combined - stated) / stated;
    return diff <= 0.2
      ? { match: true, msg: `Combined real estate + liquidity ($${combined.toLocaleString()}) reasonably supports the stated net worth ($${stated.toLocaleString()}).` }
      : { match: false, msg: `Combined real estate + liquidity ($${combined.toLocaleString()}) doesn't closely match the stated net worth ($${stated.toLocaleString()}) — worth a follow-up question.` };
  }

  async function pullFullFile() {
    setPulling(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const { data: docIds } = await supabase.from('client_documents').select('id').eq('client_id', activeClientId);
      const ids = (docIds || []).map(d => d.id);
      const { data: files } = await supabase.from('document_files').select('*').in('client_document_id', ids);
      for (const f of files || []) {
        const { data: blob } = await supabase.storage.from('documents').download(f.storage_path);
        if (blob) zip.file(f.original_filename, blob);
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeClient.full_name.replace(/\s+/g, '-')}-full-file.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Could not build the file pull: ' + e.message);
    }
    setPulling(false);
  }

  const activeClient = clients.find(c => c.id === activeClientId);
  const merged = docTypes.map(dt => {
    const cd = clientDocs.find(d => d.document_type_id === dt.id);
    return { ...dt, clientDocId: cd?.id, status: cd?.status || 'missing' };
  });
  const receivedCount = merged.filter(m => m.status === 'received').length;
  const allReceived = docTypes.length > 0 && receivedCount === docTypes.length;
  const check = nwCheck();

  if (!session) return null;

  return (
    <div className="app-shell">
      <div className="sidebar">
        <div className="brand"><div className="mark">Ledger</div><div className="sub">Case file portal</div></div>
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
                  <div className={`stamp ${doc.status === 'received' ? 'received' : 'missing'}`}>{doc.status === 'received' ? '\u2713' : '!'}</div>
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
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="action-btn" disabled={pulling} onClick={pullFullFile}>{pulling ? 'Building file...' : 'Pull complete file (.zip)'}</button>
                <button className="action-btn primary" disabled={!allReceived || activeClient.status === 'sent_to_lender'} onClick={sendToLender}>
                  {activeClient.status === 'sent_to_lender' ? 'Sent to carrier & lender \u2713' : 'Send file to carrier & lender'}
                </button>
              </div>
            </div>

            <div className="networth-panel">
              <h3>Net worth cross-check</h3>
              <div className="subtext">Enter the figures from the client's PFS, real estate schedule, and liquidity statements to check they're consistent.</div>
              <div className="networth-row">
                <div className="field"><label>Stated net worth (PFS)</label>
                  <input type="number" value={nw.stated} onChange={e => setNw({ ...nw, stated: e.target.value })} placeholder="25000000" /></div>
                <div className="field"><label>Real estate schedule value</label>
                  <input type="number" value={nw.realEstate} onChange={e => setNw({ ...nw, realEstate: e.target.value })} placeholder="15000000" /></div>
                <div className="field"><label>Liquidity statements value</label>
                  <input type="number" value={nw.liquidity} onChange={e => setNw({ ...nw, liquidity: e.target.value })} placeholder="8000000" /></div>
              </div>
              <button className="action-btn" onClick={saveNw}>Save figures</button>
              {check && <div className={`networth-result ${check.match ? 'match' : 'mismatch'}`}>{check.match ? '\u2713 ' : '\u26a0 '}{check.msg}</div>}
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
