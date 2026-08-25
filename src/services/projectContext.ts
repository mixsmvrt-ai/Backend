const musicalContextTerms = /\b(?:progression|melody|chords?|harmony|bass(?:line)?|drums?|rhythm|beat|part|layer|track|idea|version|project|song|composition|arrangement|hook|motif)\b/i;

export function requestsEarlierProjectContext(prompt: string) {
	const hasEarlierReference = /\b(?:earlier|previous(?:ly)?|before|already|built|created|made|wrote|mentioned|continue|based\s+on)\b/i.test(prompt)
		|| /\b(?:that|this|same|it)\s+(?:progression|melody|chords?|harmony|bass(?:line)?|drums?|rhythm|beat|part|layer|track|idea|version|project|song|composition|arrangement|hook|motif)\b/i.test(prompt)
		|| /\b(?:add|use|make|create)\b[\s\S]*\b(?:to|from|for)\s+(?:the|that|this|same|it)\b/i.test(prompt);
	return hasEarlierReference && musicalContextTerms.test(prompt);
}