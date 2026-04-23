/**
 * Dev-only TLS material for Vite. Chrome requires subjectAltName type 7 (IP)
 * for https://192.168.x.x — @vitejs/plugin-basic-ssl only adds type 2 (DNS),
 * so numeric “domains” there never match the host the phone uses.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import selfsigned from 'selfsigned'

export function lanIpv4Addresses(): string[] {
  const set = new Set<string>()
  for (const list of Object.values(os.networkInterfaces())) {
    for (const iface of list ?? []) {
      if (!iface || iface.internal) continue
      const fam = iface.family as string | number
      if (fam === 'IPv4' || fam === 4) set.add(iface.address)
    }
  }
  return [...set]
}

export function getDevHttpsCredentials(): { key: string; cert: string } {
  const lan = lanIpv4Addresses()
  const tag = crypto.createHash('sha256').update([...lan].sort().join(',')).digest('hex').slice(0, 16)
  const dir = path.join(process.cwd(), 'node_modules', '.vite', 'dev-https')
  const keyFile = path.join(dir, `key-${tag}.pem`)
  const certFile = path.join(dir, `cert-${tag}.pem`)

  if (fs.existsSync(keyFile) && fs.existsSync(certFile)) {
    return {
      key: fs.readFileSync(keyFile, 'utf8'),
      cert: fs.readFileSync(certFile, 'utf8'),
    }
  }

  const altNames: Array<{ type: number; value?: string; ip?: string }> = [
    { type: 2, value: 'localhost' },
    { type: 7, ip: '127.0.0.1' },
    ...lan.map((ip) => ({ type: 7, ip })),
  ]

  const pems = selfsigned.generate(
    [{ name: 'commonName', value: 'MyDailyApp dev' }],
    {
      days: 30,
      keySize: 2048,
      algorithm: 'sha256',
      extensions: [
        { name: 'basicConstraints', cA: false },
        {
          name: 'keyUsage',
          digitalSignature: true,
          keyEncipherment: true,
        },
        { name: 'extKeyUsage', serverAuth: true },
        { name: 'subjectAltName', altNames },
      ],
    },
  )

  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(keyFile, pems.private)
  fs.writeFileSync(certFile, pems.cert)

  return { key: pems.private, cert: pems.cert }
}
