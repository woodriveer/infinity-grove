// Fake Steamworks Web API for CI's sync-e2e job (refactor AD-21, RFR-29).
// Implements only ISteamUserAuth/AuthenticateUserTicket/v1, the one call the
// backend's SteamAuthTicketVerifier makes. Tickets of the form "test-<steamid64>"
// are accepted as that SteamID64; anything else is rejected like an invalid ticket.
import { createServer } from 'node:http';

const port = Number(process.env.PORT ?? 8080);

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://fake-steam');
  res.setHeader('Content-Type', 'application/json');
  if (url.pathname === '/health') {
    res.end('{"ok":true}');
    return;
  }
  if (url.pathname.replace(/\/+$/, '') !== '/ISteamUserAuth/AuthenticateUserTicket/v1') {
    res.statusCode = 404;
    res.end('{}');
    return;
  }
  const ticket = url.searchParams.get('ticket') ?? '';
  const match = /^test-(\d{17})$/.exec(ticket);
  const body = match
    ? { response: { params: { result: 'OK', steamid: match[1], ownersteamid: match[1], vacbanned: false, publisherbanned: false } } }
    : { response: { error: { errorcode: 101, errordesc: 'Invalid ticket' } } };
  res.end(JSON.stringify(body));
}).listen(port, () => console.log(`fake-steam listening on ${port}`));
