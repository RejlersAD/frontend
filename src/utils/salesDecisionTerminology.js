// Presentation only: never use this text as a workflow value or API parameter.
export const decisionText = (value) => typeof value === 'string'
  ? value.replace(/\bno[ -]bid\b/gi, 'No-Go').replace(/\bbid\b/gi, 'Go')
  : value;
