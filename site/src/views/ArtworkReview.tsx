import { useState } from 'react';
import ArtworkPicker from '../components/ArtworkPicker';

export default function ArtworkReview() {
  const [file, setFile] = useState<File | null>(null);
  return <main className="wrap solo"><h1>Artwork upload check</h1><p>Local test only. Files stay in your browser. Nothing is uploaded or assigned to a member.</p><ArtworkPicker file={file} onChange={setFile} /><button disabled={!file} onClick={() => setFile(null)}>Clear selected artwork</button><p role="status">{file ? 'Image ready for upload review.' : 'No validated image selected.'}</p></main>;
}
