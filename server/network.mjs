import { BlockList, isIP } from 'node:net';

const normalIp = (value) => typeof value === 'string' ? value.trim().replace(/^::ffff:(?=\d)/i, '') : '';
const family = (ip) => isIP(ip) === 6 ? 'ipv6' : 'ipv4';

export function trustedProxyIps(configured) {
  const peers = new BlockList();
  const addresses = (configured || '').split(',').map(normalIp).filter(Boolean);
  for (const address of addresses) {
    if (!isIP(address)) throw new Error('FLYTOASPAN_TRUSTED_PROXY_IPS yalnızca tekil IP adresleri kabul eder.');
    peers.addAddress(address, family(address));
  }
  return {
    configured: addresses.length > 0,
    resolve(req) {
      const peer = normalIp(req.socket.remoteAddress);
      const trusted = Boolean(isIP(peer)) && peers.check(peer, family(peer));
      const forwarded = trusted ? normalIp(req.headers['x-real-ip']) : '';
      return {
        ip: isIP(forwarded) ? forwarded : peer || 'unknown',
        protocol: req.socket.encrypted || (trusted && req.headers['x-forwarded-proto'] === 'https') ? 'https' : 'http',
      };
    },
  };
}
