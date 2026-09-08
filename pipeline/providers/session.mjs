// "Session" provider: the job pack is submitted through a Higgsfield-connected Claude session
// (the MCP tools generate_image / generate_video_batch / jobs_wait), exactly as the first nine
// Credit’s Lair films were made. This provider does not talk to the network itself; it writes the
// pack and reads back a results file so the manifest stays exact.
//
// Results file shape (stories/<slug>/results.json):
// { "jobs": [ { "id": "film:gate-win", "jobId": "<hf job id>", "url": "https://.../x.mp4", "model": "seedance_2_5" }, ... ] }
export const name = 'higgsfield-session';

export function instructions(pack) {
  const films = pack.stages.films.length, assets = pack.stages.assets.length;
  return [
    `Job pack for "${pack.slug}" (${pack.provider}, model ${pack.model}): ${assets} asset request(s), ${films} film request(s).`,
    'In a Higgsfield-connected session:',
    '  1. Assets stage: run each generate_image request; upload/import results and note media ids or job ids.',
    '     Create reference elements for character sheets and record them as characters.<id>.element in story.mjs.',
    '  2. Films stage: resolve placeholders ({{keyframe:..}}, {{sheet:..}}, {{clip:..:last}}, {{job:..}}) to media ids or job ids,',
    '     then submit with generate_video_batch in dependency order (dependsOn lists the parent film).',
    '  3. Wait with jobs_wait, then write stories/<slug>/results.json with { id, jobId, url } per request.',
    '  4. Run: node scripts/story.mjs <slug> ingest   (downloads, probes, records hashes into media.json)',
    '  5. Run: node scripts/story.mjs <slug> review   (contact sheets + congruency review)',
    'Credits are only spent when jobs are explicitly submitted. Nothing here runs automatically.',
  ].join('\n');
}
