import * as puppeteer from 'puppeteer';
import { Logger } from '../logger/Logger';

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

export class PddiktiScraper {
  private logger: Logger;
  private baseUrl = 'https://pddikti.kemdiktisaintek.go.id';

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Launch browser with common settings
   */
  private async launchBrowser(): Promise<puppeteer.Browser> {
    return puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
  }

  /**
   * Search mahasiswa by name using Puppeteer
   */
  async searchMahasiswa(nama: string): Promise<MahasiswaInfo[]> {
    let browser: puppeteer.Browser | null = null;
    
    try {
      const encodedNama = encodeURIComponent(nama);
      const searchUrl = `${this.baseUrl}/search/${encodedNama}`;

      this.logger.info('Searching PDDIKTI', { nama, url: searchUrl });

      browser = await this.launchBrowser();
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForNetworkIdle({ timeout: 30000 }).catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Get body text and detail URLs
      const bodyText = await page.evaluate('document.body.innerText') as string;
      
      // Check for server errors
      if (bodyText.includes('503') || bodyText.includes('502') || bodyText.includes('Temporarily Unavailable')) {
        throw new Error('PDDIKTI server sedang tidak tersedia (503). Coba lagi nanti.');
      }
      
      const detailUrls = await page.evaluate(`
        Array.from(document.querySelectorAll('a[href*="detail-mahasiswa"]')).map(a => a.href)
      `) as string[];

      const results = this.parseMahasiswaFromText(bodyText, detailUrls);

      this.logger.info('PDDIKTI search completed', { resultsCount: results.length });
      return results;
    } catch (error) {
      this.logger.error('Failed to search PDDIKTI', error as Error);
      throw error;
    } finally {
      if (browser) await browser.close();
    }
  }

  /**
   * Get detail mahasiswa from detail page
   */
  async getDetailMahasiswa(detailUrl: string): Promise<MahasiswaDetail | null> {
    let browser: puppeteer.Browser | null = null;
    
    try {
      this.logger.info('Fetching mahasiswa detail', { url: detailUrl });

      browser = await this.launchBrowser();
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForNetworkIdle({ timeout: 30000 }).catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 10000));

      const bodyText = await page.evaluate('document.body.innerText') as string;
      const detail = this.parseDetailFromText(bodyText);

      this.logger.info('Detail fetched', { nama: detail?.nama });
      return detail;
    } catch (error) {
      this.logger.error('Failed to get detail', error as Error);
      return null;
    } finally {
      if (browser) await browser.close();
    }
  }

  /**
   * Parse mahasiswa data from body text
   */
  private parseMahasiswaFromText(text: string, detailUrls: string[]): MahasiswaInfo[] {
    const results: MahasiswaInfo[] = [];
    
    const mahasiswaStart = text.indexOf('MahasiswaNama');
    if (mahasiswaStart === -1) return results;
    
    let mahasiswaEnd = text.length;
    const endMarkers = ['Perguruan TinggiTidak', 'Program StudiTidak', 'Pusat Data'];
    for (const marker of endMarkers) {
      const idx = text.indexOf(marker, mahasiswaStart);
      if (idx !== -1 && idx < mahasiswaEnd) mahasiswaEnd = idx;
    }
    
    let mahasiswaSection = text.substring(mahasiswaStart, mahasiswaEnd);
    if (mahasiswaSection.includes('Tidak ada hasil pencarian')) return results;
    
    mahasiswaSection = mahasiswaSection.replace(/MahasiswaNama\s+NIM\s+Perguruan Tinggi\s+Program Studi\s+Aksi/g, '');
    const entries = mahasiswaSection.split('Lihat Detail').filter(e => e.trim().length > 5);
    
    let urlIndex = 0;
    for (const entry of entries) {
      let clean = entry.trim().replace(/\d+dari\d+/g, '').trim();
      if (clean.length < 5) continue;
      
      const parts = clean.split(/\t+|\s{2,}/).filter(p => p.trim().length > 0);
      
      if (parts.length >= 4) {
        results.push({
          nama: parts[0].trim(),
          nim: parts[1].trim(),
          pt: parts[2].trim(),
          prodi: parts[3].trim(),
          detailUrl: detailUrls[urlIndex] || undefined,
        });
        urlIndex++;
      }
    }
    
    return results;
  }

  /**
   * Parse detail mahasiswa from body text
   */
  private parseDetailFromText(text: string): MahasiswaDetail | null {
    try {
      const getValue = (label: string): string => {
        const idx = text.indexOf(label);
        if (idx === -1) return '';
        
        const afterLabel = text.substring(idx + label.length);
        const nextLabels = ['Perguruan Tinggi', 'Jenis Kelamin', 'Tanggal Masuk', 'NIM', 'Jenjang', 'Status Awal', 'Status Terakhir', 'Pusat Data'];
        
        let endIdx = afterLabel.length;
        for (const nl of nextLabels) {
          const nlIdx = afterLabel.indexOf(nl);
          if (nlIdx !== -1 && nlIdx < endIdx) endIdx = nlIdx;
        }
        
        return afterLabel.substring(0, endIdx).trim();
      };

      return {
        nama: getValue('Nama'),
        pt: getValue('Perguruan Tinggi'),
        jenisKelamin: getValue('Jenis Kelamin'),
        tanggalMasuk: getValue('Tanggal Masuk'),
        nim: getValue('NIM'),
        jenjangProdi: getValue('Jenjang - Program Studi'),
        statusAwal: getValue('Status Awal Mahasiswa'),
        statusTerakhir: getValue('Status Terakhir Mahasiswa'),
      };
    } catch {
      return null;
    }
  }

  /**
   * Format search results for WhatsApp
   */
  formatResults(results: MahasiswaInfo[], searchQuery: string): string {
    if (results.length === 0) {
      return `❌ Tidak ditemukan data mahasiswa dengan nama "${searchQuery}"`;
    }

    let message = `📚 *Hasil Pencarian PDDIKTI*\n`;
    message += `🔍 Kata kunci: ${searchQuery}\n`;
    message += `📊 Ditemukan: ${results.length} hasil\n\n`;

    const displayResults = results.slice(0, 10);
    
    displayResults.forEach((mhs, index) => {
      message += `*${index + 1}. ${mhs.nama}*\n`;
      message += `   🆔 NIM: ${mhs.nim}\n`;
      message += `   🏫 PT: ${mhs.pt}\n`;
      message += `   📖 Prodi: ${mhs.prodi}\n\n`;
    });

    if (results.length > 10) {
      message += `_...dan ${results.length - 10} hasil lainnya_\n\n`;
    }

    message += `📝 _Balas dengan angka (1-${Math.min(results.length, 10)}) untuk lihat detail_`;

    return message;
  }

  /**
   * Format detail mahasiswa for WhatsApp
   */
  formatDetail(detail: MahasiswaDetail): string {
    let message = `📋 *Detail Mahasiswa*\n\n`;
    message += `👤 *Nama:* ${detail.nama}\n`;
    message += `🏫 *Perguruan Tinggi:* ${detail.pt}\n`;
    message += `🆔 *NIM:* ${detail.nim}\n`;
    message += `📖 *Jenjang - Prodi:* ${detail.jenjangProdi}\n`;
    message += `👥 *Jenis Kelamin:* ${detail.jenisKelamin}\n`;
    message += `📅 *Tanggal Masuk:* ${detail.tanggalMasuk}\n`;
    message += `🚀 *Status Awal:* ${detail.statusAwal}\n`;
    message += `📊 *Status Terakhir:* ${detail.statusTerakhir}\n`;

    return message;
  }
}
