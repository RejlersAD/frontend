/** Called only after an uncertain upload response, against listJobs({ mine: 1 }). */
export function findAcceptedS3DUpload(jobs, file, startedAt) {
  if (!Array.isArray(jobs) || !file || !Number.isFinite(startedAt)) return null;
  const matches = jobs.filter(job => {
    const source = job.document_meta;
    const created = Date.parse(job.created_at);
    return ['queued', 'processing', 'completed'].includes(job.status)
      && source?.original_filename === file.name
      && Number(source.file_size_bytes) === file.size
      && Number.isFinite(created) && created >= startedAt;
  });
  return matches.length === 1 ? matches[0] : null;
}
