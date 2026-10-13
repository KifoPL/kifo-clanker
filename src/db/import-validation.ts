export type LegacyRow = Record<string, unknown>;

export function legacyRow(value: unknown): LegacyRow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Row must be an object.');
  return value as LegacyRow;
}

export function field(row: LegacyRow, name: string): unknown {
  const keys = Object.keys(row).filter((key) => key.toLowerCase() === name.toLowerCase());
  if (keys.length > 1) throw new Error(`${name} has ambiguous duplicate field names.`);
  return keys[0] === undefined ? undefined : row[keys[0]];
}

export function text(value: unknown, name: string, maximum = 4_000): string {
  if (typeof value !== 'string' || !value.length || value.length > maximum || value.includes('\0')) {
    throw new Error(`${name} must be nonempty text up to ${maximum} characters.`);
  }
  return value;
}

export function integer(value: unknown, name: string, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number {
  const result = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof result !== 'number' || !Number.isSafeInteger(result) || result < minimum || result > maximum) {
    throw new Error(`${name} must be an exact integer from ${minimum} to ${maximum}.`);
  }
  return result;
}

export function identifier(value: unknown, name: string): string {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be exported as a decimal string to preserve ID precision.`);
    value = String(value);
  }
  if (typeof value !== 'string' || !/^[1-9]\d{0,19}$/.test(value) || BigInt(value) > 18_446_744_073_709_551_615n) {
    throw new Error(`${name} must be an exact positive unsigned 64-bit decimal ID.`);
  }
  return value;
}

export function bit(value: unknown, name: string): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 0 || value === '0') return false;
  if (value === 1 || value === '1') return true;
  if (value && typeof value === 'object' && !Array.isArray(value)
    && 'type' in value && value.type === 'Buffer' && 'data' in value
    && Array.isArray(value.data) && value.data.length === 1
    && (value.data[0] === 0 || value.data[0] === 1)) {
    return value.data[0] === 1;
  }
  throw new Error(`${name} must be boolean, BIT 0/1, or a one-byte Buffer JSON value.`);
}

export function timezoneOffset(value: unknown): string {
  if (value === 'Z') return '+00:00';
  if (typeof value !== 'string' || !/^[+-](?:0\d|1[0-4]):[0-5]\d$/.test(value)
    || (value.slice(1, 3) === '14' && value.slice(4) !== '00')) {
    throw new Error('Snapshot timezone must be an explicit UTC offset, for example +00:00.');
  }
  return value;
}

export function timestamp(value: unknown, name: string, offset: string): string {
  if (typeof value !== 'string') throw new Error(`${name} must be an ISO timestamp or MySQL datetime string.`);
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})?$/.exec(value);
  if (!match) throw new Error(`${name} must include a valid date and time.`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const fraction = match[7] ?? '';
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31
    || hour > 23 || minute > 59 || second > 59 || /[1-9]/.test(fraction.slice(3))) {
    throw new Error(`${name} has an invalid calendar value or precision finer than milliseconds.`);
  }
  const calendar = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) throw new Error(`${name} has an invalid calendar date.`);
  const zone = timezoneOffset(match[8] ?? offset);
  const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}.${fraction.slice(0, 3).padEnd(3, '0')}${zone}`;
  const parsed = new Date(iso);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`${name} is invalid.`);
  return parsed.toISOString();
}
