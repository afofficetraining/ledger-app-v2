import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

export default function ClientPortal() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [client, setClient] = useState(null);
  const [docTypes, setDocTypes] = useState([]);
  const [clientDocs, setClientDocs] = useState([]);
  const [uploadingId, setUploadingId] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.push('/client/login');
        return;
      }
      setSession(data.session);
      const email = data.session.user.email;
      const { data: clientRow } = await supabase.from('clients').select('*').eq('email', email).single();
      if (!clientRow) {
        alert('No case file found for this email yet. Contact your agent.');
        return;
      }
      setClient(clientRow);
      const { data: types } = await supabase.from('document_types').select('*').order('sort_order');
      setDocTypes(types || []);
      const { data: docs } = await supabase.from('client_documents').select('*').eq('client_id', clientRow.id);
      setClientDocs(docs || []);
    });
  }, [router]);

  async function handleUpload(e, docTypeId, clientDocId) {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingId(docTypeId);
    const path = `${client.id}/${docTypeId}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from('documents').upload(path, file, { upsert: true });
    if (uploadError) {
      alert('Upload failed: ' + uploadError.message);
      setUploadingId(null);
      return;
    }
    await supabase.from('document_files').insert({ client_document_id: clientDocId, storage_path: path, original_filename: file.name, uploaded_by: 'client' });
    await supabase.from('client_documents').update({ status: 'received', received_at: new Date().toISOString() }).eq('id', clientDocId);
    const docType = docTypes.find(d => d.id === docTypeId);
    await supabase.from('notifications').insert({ client_id: client.id, title: 'New document uploaded', body: `${client.full_name} uploaded "${docType?.name}".` });
    const { data: docs } = await supabase.from('client_documents').select('*').eq('client_id', client.id);
    setClientDocs(docs || []);
    setUploadingId(null);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push('/client/login');
  }

  if (!client) return <div className="centered-shell"><p>Loading your case file...</p></div>;

  const merged = docTypes.map(dt => {
    const cd = clientDocs.find(d => d.document_type_id === dt.id);
    return { ...dt, clientDocId: cd?.id, status: cd?.status || 'missing' };
  });
  const receivedCount = merged.filter(m => m.status === 'received').length;

  return (
    <div className="main" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="topbar">
        <div>
          <h1 className="case-title">Welcome, {client.full_name.split(' ').slice(-1)}</h1>
          <div className="case-meta">{receivedCount} of {docTypes.length} documents received</div>
        </div>
        <span className="logout-link" onClick={logout}>Sign out</span>
      </div>

      <div className="ledger">
        {merged.map(doc => (
          <div className="ledger-row" key={doc.id}>
            <div className={`stamp ${doc.status === 'received' ? 'received' : 'missing'}`}>{doc.status === 'received' ? '✓' : '!'}</div>
            <div className="doc-name">
              <div className="title">{doc.name}</div>
              <div className="desc">{doc.description}</div>
            </div>
            {doc.status === 'received' ? (
              <span style={{ fontSize: 11.5, color: 'var(--received)', fontWeight: 600 }}>Received</span>
            ) : (
              <div className="upload-row">
                <input type="file" onChange={e => handleUpload(e, doc.id, doc.clientDocId)} disabled={uploadingId === doc.id} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
