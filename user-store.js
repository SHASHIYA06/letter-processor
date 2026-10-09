// ══════════════════════════════════════════════════════════════
//  LOCATION-WISE USER STORE
//  Persistent user database (JSON file) + Google Sheets mirroring
// ══════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Columns for the mirrored Google Sheet ("Users")
export const USER_COLUMNS = [
  'S.No', 'Username', 'Full Name', 'Email', 'Phone', 'Role',
  'Org Code', 'Location ID', 'City', 'State', 'Status',
  'Created At', 'Last Login', 'Password Hash'
];

const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 };

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64, SCRYPT_OPTS).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(user, password) {
  try {
    const [salt, hash] = (user.passwordHash || '').split(':');
    if (!salt || !hash) return false;
    const test = crypto.scryptSync(password, salt, 64, SCRYPT_OPTS).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
  } catch {
    return false;
  }
}

export function publicProfile(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

export function createUserStore(dataDir) {
  const file = path.join(dataDir, 'users.json');
  let data = { version: 2, nextSeq: 1, users: [] };

  function load() {
    try {
      if (fs.existsSync(file)) {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (parsed && Array.isArray(parsed.users)) {
          data = { version: 2, nextSeq: parsed.nextSeq || parsed.users.length + 1, users: parsed.users };
        }
      }
    } catch (err) {
      console.log('⚠️  User store load failed:', err.message);
    }
  }

  function save() {
    try {
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      const tmp = file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
      fs.renameSync(tmp, file);
    } catch (err) {
      console.log('⚠️  User store save failed:', err.message);
    }
  }

  load();

  return {
    file,
    count: () => data.users.length,

    findByUsername(username) {
      if (!username) return null;
      const u = String(username).trim().toLowerCase();
      return data.users.find(x => x.username === u) || null;
    },

    findById(id) {
      return data.users.find(x => x.id === id) || null;
    },

    findByEmail(email) {
      if (!email) return null;
      const e = String(email).trim().toLowerCase();
      return data.users.find(x => x.email === e) || null;
    },

    countByLocation(locationId) {
      return data.users.filter(x => x.locationId === locationId).length;
    },

    countByOrg(org) {
      return data.users.filter(x => x.org === org).length;
    },

    getAll() {
      return [...data.users];
    },

    nextUsername(prefix) {
      let seq = data.nextSeq;
      let candidate;
      do {
        candidate = `${prefix}-${String(seq).padStart(4, '0')}`;
        seq++;
      } while (this.findByUsername(candidate));
      return candidate;
    },

    create({ name, email, phone, username, password, locationId, org, city, state, role = 'user' }) {
      const uname = String(username || '').trim().toLowerCase();
      const user = {
        id: crypto.randomUUID(),
        seq: data.nextSeq,
        username: uname,
        name: String(name || '').trim(),
        email: String(email || '').trim().toLowerCase(),
        phone: String(phone || '').trim(),
        role,
        org,
        locationId,
        city,
        state,
        status: 'active',
        createdAt: new Date().toISOString(),
        lastLogin: null,
        lastIp: null,
        passwordHash: hashPassword(password)
      };
      data.users.push(user);
      data.nextSeq = data.nextSeq + 1;
      save();
      console.log(`✅ User created: ${user.username} @ ${locationId} (${org})`);
      return user;
    },

    updateLogin(id, ip) {
      const user = this.findById(id);
      if (!user) return null;
      user.lastLogin = new Date().toISOString();
      user.lastIp = ip || null;
      save();
      return user;
    },

    // Upsert a row synced from the Google Sheets "Users" mirror (keeps Vercel/ephemeral FS alive)
    upsertFromSheet(row) {
      // Expected row: [sno, username, name, email, phone, role, org, locationId, city, state, status, createdAt, lastLogin, pwHash]
      if (!Array.isArray(row) || row.length < 10) return false;
      const username = String(row[1] || '').trim().toLowerCase();
      if (!username) return false;
      const existing = this.findByUsername(username);
      const rec = {
        id: existing?.id || crypto.randomUUID(),
        seq: parseInt(row[0]) || data.nextSeq,
        username,
        name: String(row[2] || ''),
        email: String(row[3] || '').toLowerCase(),
        phone: String(row[4] || ''),
        role: String(row[5] || 'user'),
        org: String(row[6] || ''),
        locationId: String(row[7] || ''),
        city: String(row[8] || ''),
        state: String(row[9] || ''),
        status: String(row[10] || 'active'),
        createdAt: row[11] || new Date().toISOString(),
        lastLogin: row[12] || null,
        lastIp: existing?.lastIp || null,
        passwordHash: String(row[13] || '')
      };
      if (existing) {
        Object.assign(existing, rec);
      } else {
        data.users.push(rec);
        if (rec.seq >= data.nextSeq) data.nextSeq = rec.seq + 1;
      }
      save();
      return true;
    }
  };
}
