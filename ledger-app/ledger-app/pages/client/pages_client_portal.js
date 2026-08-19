import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

const INTAKE_FIELDS = [
  { key: 'dob', label: 'Date of Birth', type: 'date' },
  { key: 'sex', label: 'Sex (M/F)' },
  { key: 'height', label: 'Height' },
  { key: 'weight', label: 'Weight' },
  { key: 'phone', label: 'Phone Number' },
  { key: 'address', label: 'Address' },
  { key: 'city_state_zip', label: 'City, State, Zip' },
  { key: 'employer', label: 'Employer' },
  { key: 'occupation', label: 'Occupation' },
  { key: 'years_employed', label: 'How long employed?' },
  { key: 'annual_income', label: 'Annual Income' },
  { key: 'net_worth', label: 'Net Worth' },
  { key: 'tobacco', label: 'Tobacco use in last 24 months? (Y/N)' },
  { key: 'marital_status', label: 'Married? (Y/N)' },
  { key: 'spouse_insurance', label: "Spouse's life insurance amount, if any" },
  { key: 'state_born', label: 'State you were born in' },
  { key: 'physician_name', label: "Personal Physician's Name, Address, Phone" },
  { key: 'last_consulted', label: 'Date last consulted physician' },
  { key: 'visit_reason', label: 'Reason for last visit' },
  { key: 'other_doctors', label: 'Seen another doctor/hospital in last 5 years? Details' },
  { key: 'medications', label: 'Current medications' },
  { key: 'health_conditions', label: 'Eye/kidney/circulation/heart/blood pressure issues? Details' },
  { key: 'travel_plans', label: 'Planned travel outside the US in next 24 months? Details' },
  { key: 'dl_state', label: "Driver's License State" },
  { key: 'dl_number', label: "Driver's License Number" },
  { key: 'email', label: 'Email Address' },
];

export default function ClientPortal() {
  const router = useRouter();
  const [client, setClient] = useState(null);
  const [docTypes, setDocTypes] = useState([]);
  const [clientDocs, setClientDocs] = useState([]);
  const [uploadingId, setUploadingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [signingDoc, setSigningDoc] = useState(null);
  const [printName, setPrintName] = useState('');
  const [ssn, setSsn] = useState('');
  const [signDate, setSignDate] = useState('');
  const [signature, setSignature] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [intake, setIntake] = useState({});

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

  async function uploadFile(file, docTypeId, clientDocId) {
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

  function handleFileInput(e, docTypeId, clientDocId) {
    const file = e.target.files[0];
    if (file) uploadFile(file, docTypeId, clientDocId);
  }

  function handleDrop(e, docTypeId, clientDocId) {
    e.preventDefault();
    setDragOverId(null);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file, docTypeId, clientDocId);
  }

  function needsSsn(doc) {
    return doc.name.includes('HIPAA') || doc.name.includes('Preliminary Inquiry');
  }
  function isIntakeForm(doc) {
    return doc.name.includes('Preliminary Inquiry');
  }

  function openSignModal(doc) {
    setSigningDoc(doc);
    setPrintName(client.full_name || '');
    setSsn('');
    setSignDate(new Date().toISOString().slice(0, 10));
    setSignature('');
    setAgreed(false);
    setIntake({});
  }

  function closeSignModal() {
    setSigningDoc(null);
  }

  function downloadForWetSignature() {
    const w = window.open('', '_blank');
    const ssnLine = needsSsn(signingDoc) ? `<p><b>SSN:</b> ${ssn || '_______________'}</p>` : '';
    const intakeLines = isIntakeForm(signingDoc)
      ? INTAKE_FIELDS.map(f => `<p><b>${f.label}:</b> ${intake[f.key] || '_______________'}</p>`).join('')
      : '';
    const w2 = w;
    w2.document.write(`
      <html><head><title>${signingDoc.name}</title>
      <style>
        body{ font-family: Georgia, serif; max-width: 650px; margin: 60px auto; color: #1B1B18; line-height: 1.6; }
        h1{ font-size: 22px; border-bottom: 2px solid #A9822F; padding-bottom: 10px; }
        .field-line{ margin: 30px 0 6px; border-bottom: 1px solid #999; width: 400px; height: 24px; }
        .label{ font-size: 12px; color: #555; }
        p{ font-size: 13.5px; margin: 6px 0; }
      </style>
      </head><body>
        <h1>${signingDoc.name}</h1>
        <p>${signingDoc.description}</p>
        <p>I, <b>${printName || '_______________'}</b>, certify that I have read and agree to this document.</p>
        ${ssnLine}
        ${intakeLines}
        <p><b>Date:</b> ${signDate}</p>
        <div class="field-line"></div>
        <div class="label">Signature (sign by hand above)</div>
        <script>window.print();</script>
      </body></html>
    `);
    w2.document.close();
  }

  function wrapAndDraw(ctx, text, x, y, maxWidth, lineHeight) {
    const words = String(text).split(' ');
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
    return cy + lineHeight;
  }

  async function submitSignature() {
    if (!printName.trim() || !signature.trim() || !agreed) return;
    const docTypeId = signingDoc.id;
    const clientDocId = signingDoc.clientDocId;
    const intakeMode = isIntakeForm(signingDoc);

    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = intakeMode ? 1400 : 460;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#1B1B18';
    ctx.font = '20px sans-serif';
    ctx.fillText(signingDoc.name, 40, 45);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#5B5A52';
    let y = 90;
    y = wrapAndDraw(ctx, `Print Name: ${printName}`, 40, y, 800, 20) + 4;
    if (needsSsn(signingDoc)) y = wrapAndDraw(ctx, `SSN: ${ssn}`, 40, y, 800, 20) + 4;
    y = wrapAndDraw(ctx, `Date: ${signDate}`, 40, y, 800, 20) + 14;

    if (intakeMode) {
      for (const f of INTAKE_FIELDS) {
        y = wrapAndDraw(ctx, `${f.label}: ${intake[f.key] || '\u2014'}`, 40, y, 820, 20) + 6;
      }
      y += 20;
    }

    ctx.strokeStyle = '#D8D1BF';
    ctx.beginPath();
    ctx.moveTo(40, y + 20);
    ctx.lineTo(600, y + 20);
    ctx.stroke();
    ctx.font = 'italic 40px Georgia, serif';
    ctx.fillStyle = '#0F1E30';
    ctx.fillText(signature, 45, y + 10);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#5B5A52';
    ctx.fillText('Signature', 40, y + 45);
    ctx.fillText(`Signed electronically on ${new Date().toLocaleString()}`, 40, y + 70);

    canvas.toBlob(async (blob) => {
      const path = `${client.id}/${docTypeId}-signed.png`;
      const { error: uploadError } = await supabase.storage.from('documents').upload(path, blob, { upsert: true, contentType: 'image/png' });
      if (uploadError) {
        alert('Signing failed: ' + uploadError.message);
        return;
      }
      await supabase.from('document_files').insert({ client_document_id: clientDocId, storage_path: path, original_filename: `${signingDoc.name} - signed.png`, uploaded_by: 'client' });
      await supabase.from('client_documents').update({ status: 'received', received_at: new Date().toISOString() }).eq('id', clientDocId);
      await supabase.from('notifications').insert({ client_id: client.id, title: 'Document signed', body: `${client.full_name} submitted "${signingDoc.name}".` });
      await refreshDocs();
      closeSignModal();
    }, 'image/png');
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
    <div className="main" style={{ maxWidth: 680, margin: '0 auto' }}>
      <div className="topbar">
        <div>
          <h1 className="case-title">Welcome, {client.full_name.split(' ').slice(-1)}</h1>
          <div className="case-meta">{receivedCount} of {docTypes.length} documents received</div>
        </div>
        <span className="logout-link" onClick={logout}>Sign out</span>
      </div>

      <div className="ledger">
        {merged.map(doc => (
          <div className="ledger-row" key={doc.id} style={{ flexWrap: 'wrap' }}>
            <div className={`stamp ${doc.status === 'received' ? 'received' : 'missing'}`}>{doc.status === 'received' ? '\u2713' : '!'}</div>
            <div className="doc-name">
              <div className="title">{doc.name}</div>
              <div className="desc">{doc.description}</div>
            </div>
            {doc.status === 'received' ? (
              <span style={{ fontSize: 11.5, color: 'var(--received)', fontWeight: 600 }}>Received</span>
            ) : doc.requires_signature ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <button className="action-btn primary" onClick={() => openSignModal(doc)}>Fill out & sign</button>
                <label style={{ fontSize: 10.5, color: 'var(--ink-soft)', cursor: 'pointer' }}>
                  or upload a signed copy
                  <input type="file" style={{ display: 'none' }} onChange={e => handleFileInput(e, doc.id, doc.clientDocId)} disabled={uploadingId === doc.id} />
                </label>
              </div>
            ) : (
              <div
                className={`dropzone ${dragOverId === doc.id ? 'dragover' : ''}`}
                style={{ width: '100%', marginTop: 8 }}
                onDragOver={e => { e.preventDefault(); setDragOverId(doc.id); }}
                onDragLeave={() => setDragOverId(null)}
                onDrop={e => handleDrop(e, doc.id, doc.clientDocId)}
                onClick={() => document.getElementById(`file-${doc.id}`).click()}
              >
                {uploadingId === doc.id ? 'Uploading...' : 'Drag a file here, or click to choose one'}
                <input id={`file-${doc.id}`} type="file" onChange={e => handleFileInput(e, doc.id, doc.clientDocId)} />
              </div>
            )}
          </div>
        ))}
      </div>

      {signingDoc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,30,48,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div style={{ background: '#fff', width: 560, maxWidth: '92vw', borderRadius: 10, padding: '26px 28px', borderTop: '4px solid var(--gold)', maxHeight: '85vh', overflowY: 'auto' }}>
            <h3 style={{ fontFamily: 'Fraunces, serif', margin: '0 0 6px', fontSize: 19 }}>{signingDoc.name}</h3>
            <p style={{ color: 'var(--ink-soft)', fontSize: 13, marginBottom: 16 }}>{signingDoc.description}</p>

            <div className="field">
              <label>Print Name</label>
              <input value={printName} onChange={e => setPrintName(e.target.value)} placeholder="Full legal name" />
            </div>
            {needsSsn(signingDoc) && (
              <div className="field">
                <label>Social Security Number</label>
                <input value={ssn} onChange={e => setSsn(e.target.value)} placeholder="XXX-XX-XXXX" />
              </div>
            )}

            {isIntakeForm(signingDoc) && (
              <div style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', padding: '14px 0', margin: '14px 0' }}>
                {INTAKE_FIELDS.map(f => (
                  <div className="field" key={f.key}>
                    <label>{f.label}</label>
                    <input
                      type={f.type || 'text'}
                      value={intake[f.key] || ''}
                      onChange={e => setIntake({ ...intake, [f.key]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="field">
              <label>Date</label>
              <input type="date" value={signDate} onChange={e => setSignDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Signature (type your name)</label>
              <input value={signature} onChange={e => setSignature(e.target.value)} placeholder="Type your name to sign" style={{ fontStyle: 'italic', fontFamily: 'Georgia, serif' }} />
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 10 }}>
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop: 2 }} />
              I certify that the information provided is true and correct, and that this constitutes my electronic signature.
            </label>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
              <button className="action-btn" onClick={downloadForWetSignature} disabled={!printName.trim()}>Download to sign by hand</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="action-btn" onClick={closeSignModal}>Cancel</button>
                <button className="action-btn primary" disabled={!printName.trim() || !signature.trim() || !agreed} onClick={submitSignature}>Sign and submit</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
