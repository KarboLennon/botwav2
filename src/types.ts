// Type definitions for the WhatsApp Relay Bot

export interface BotConfig {
  numberA: string;
  numberB: string;
  botNumber: string;
  prefixA: string;
  prefixB: string;
  retryAttempts: number;
  retryDelay: number;
  maxLogSize: number;
  logDirectory: string;
  sessionDirectory: string;
}

export interface NumberMapping {
  [key: string]: string;
}

// PDDIKTI Types
export interface MahasiswaInfo {
  nama: string;
  nim: string;
  pt: string;
  prodi: string;
  detailUrl?: string;
}

export interface MahasiswaDetail {
  nama: string;
  pt: string;
  jenisKelamin: string;
  tanggalMasuk: string;
  nim: string;
  jenjangProdi: string;
  statusAwal: string;
  statusTerakhir: string;
}
