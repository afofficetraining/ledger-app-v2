import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

export default function ClientPortal() {
  const router = useRouter();
  const [client, setClient] = useState(null);
  const [docTypes, setDocTypes] = useState([]);
  const [clientDocs, setClientDocs] = useState([]);
  const [uploadingId, setUploadingId] = useState(null);
  const [signingDoc, setSigningDoc] = useState(null);
  const [signerName, setSignerName] = useState('');
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.push('/client/login');
        return;
      }
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

  async function refreshDocs() {
    const { data: docs } = await supabase.from('client_documents').select('*').eq('client_id', client.id);
    setClientDocs(docs || []);
  }

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
    await refreshDocs();
    setUploadingId(null);
  }

  function openSignModal(doc) {
    setSigningDoc(doc);
    setSignerName('');
    setAgreed(false);
  }

  function closeSignModal() {
    setSigningDoc(null);
  }

  async function submitSignature() {
    if (!signerName.trim() || !agreed) return;
    const docTypeId = signingDoc.id;
    const clientDocId = signingDoc.clientDocId;

    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#1B1B18';
    ctx.font = '20px sans-serif';
    ctx.fillText(signingDoc.name, 40, 50);
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#5B5A52';
    wrapText(ctx, `I, ${signerName}, certify that I have read and agree to this document, and am electronically signing it below.`, 40, 90, 820, 22);
    ctx.strokeStyle = '#D8D1BF';
    ctx.beginPath();
    ctx.moveTo(40, 260);
    ctx.lineTo(600, 260);
    ctx.stroke();
    ctx.font = 'italic 42px Georgia, serif';
    ctx.fillStyle = '#0F1E30';
    ctx.fillText(signerName, 45, 245);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#5B5A52';
    const signedAt = new Date().toLocaleString();
    ctx.fillText(`Signed electronically on ${signedAt}`, 40, 290);

    canvas.toBlob(async (blob) => {
      const path = `${client.id}/${docTypeId}-signed.png`;
      const { error: uploadError } = await supabase.storage.from('documents').upload(path, blob, { upsert: true, contentType: 'image/png' });
      if (uploadError) {
        alert('Signing failed: ' + uploadError.message);
        return;
      }
      await supabase.from('document_files').insert({ client_document_id: clientDocId, storage_path: path, original_filename: `${signingDoc.name} - signed.png`, uploaded_by: 'client' });
      await supabase.from('client_documents').update({ status: 'received', received_at: new Date().toISOString() }).eq('id', clientDocId);
      await supabase.from('notifications').insert({ client_id: client.id, title: 'Document signed', body: `${client.full_name} electronically signed "${signingDoc.name}".` });
      await refreshDocs();
      closeSignModal();
    }, 'image/png');
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let cy = y;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      if (ctx.measureText(testLine).width > maxWidth && n > 0) {
        ctx.fillText(line, x, cy);
        line = words[n] + ' ';
        cy += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, cy);
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
            <div className={`stamp ${doc.status === 'received' ? 'received' : 'missing'}`}>{doc.status === 'received' ? '\u2713' : '!'}</div>
            <div className="doc-name">
              <div className="title">{doc.name}</div>
              <div className="desc">{doc.description}</div>
            </div>
            {doc.status === 'received' ? (
              <span style={{ fontSize: 11.5, color: 'var(--received)', fontWeight: 600 }}>Received</span>
            ) : doc.requires_signature ? (
              <button className="action-btn primary" onClick={() => openSignModal(doc)}>Sign document</button>
            ) : (
              <div className="upload-row">
                <input type="file" onChange={e => handleUpload(e, doc.id, doc.clientDocId)} disabled={uploadingId === doc.id} />
              </div>
            )}
          </div>
        ))}
      </div>

      {signingDoc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,30,48,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', width: 460, maxWidth: '90vw', borderRadius: 10, padding: '26px 28px', borderTop: '4px solid var(--gold)' }}>
            <h3 style={{ fontFamily: 'Fraunces, serif', margin: '0 0 6px', fontSize: 19 }}>{signingDoc.name}</h3>
            <p style={{ color: 'var(--ink-soft)', fontSize: 13, marginBottom: 16 }}>{signingDoc.description}</p>
            <div className="field">
              <label>Type your full legal name to sign</label>
              <input value={signerName} onChange={e => setSignerName(e.target.value)} placeholder="Full legal name" />
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 10 }}>
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop: 2 }} />
              I certify that I have read and agree to this document, and that typing my name above constitutes my electronic signature.
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button className="action-btn" onClick={closeSignModal}>Cancel</button>
              <button className="action-btn primary" disabled={!signerName.trim() || !agreed} onClick={submitSignature}>Sign and submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
