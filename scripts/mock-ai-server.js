// A fake OpenAI-compatible endpoint for testing the AI path locally without any real key or cost.
// MOCK_MODE=good|bad|unsafe|slow
const http = require('http');
let calls = 0;
function start(port = 4555, mode = process.env.MOCK_MODE || 'good') {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      calls++;
      const parsed = JSON.parse(body || '{}');
      const m = server.mode || mode;
      const card = {
        occupationTold: 'Mummy kehti hain Infosys ke CEO ke dost hain', occupationSach: 'Excel mein VLOOKUP seekh rahe hain 3 saal se',
        salaryTold: '30 LPA, rishtedaaron ke liye', salarySach: 'Salary aate hi Swiggy le jaata hai',
        hobbies: 'Chai pe charcha, kaam pe kharcha', khoobiyan: ['Har shaadi mein DJ se gaana badalwa dete hain', 'Dosto ke liye 2 baje bhi online'],
        redFlags: ['Alarm 7 baar snooze karte hain', 'Reply "hmm" mein dete hain'], mummyVerdict: 'Bas thoda serious ho jaaye, baaki sona hai',
        score: 8.7, idealMatch: 'Jo inke memes pe hasse', tagline: 'Snooze follows my brother 😴', closer: 'Real talk: inka dil sona hai ✨',
      };
      if (m === 'unsafe') card.redFlags[0] = 'Thode mote hain'; // should be caught by output filter
      const content = m === 'bad' ? 'sorry I cannot do JSON' : JSON.stringify(card);
      const send = () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { content } }], usage: { total_tokens: 300 }, _echo_model: parsed.model, _echo_max_tokens: parsed.max_tokens, _auth: req.headers.authorization ? 'present' : 'missing' }));
      };
      m === 'slow' ? setTimeout(send, 3000) : send();
    });
  });
  server.mode = mode;
  server.calls = () => calls;
  return new Promise((r) => server.listen(port, () => r(server)));
}
if (require.main === module) start().then(() => console.log('mock AI on http://localhost:4555/v1'));
module.exports = { start };
