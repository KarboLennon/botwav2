import { Message } from 'whatsapp-web.js';
import { Logger } from '../logger/Logger';
import { PddiktiScraper, MahasiswaInfo } from '../scraper/PddiktiScraper';
import { WhatsAppClientManager } from '../client/WhatsAppClientManager';

interface PddiktiSession {
  results: MahasiswaInfo[];
  timestamp: number;
}

export class CommandHandler {
  private logger: Logger;
  private pddiktiScraper: PddiktiScraper;
  private clientManager: WhatsAppClientManager;
  private commandPrefix = '!';
  
  // Store pending selections per user (key: phone number)
  private pddiktiSessions: Map<string, PddiktiSession> = new Map();
  private sessionTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(logger: Logger, clientManager: WhatsAppClientManager) {
    this.logger = logger;
    this.clientManager = clientManager;
    this.pddiktiScraper = new PddiktiScraper(logger);
  }

  /**
   * Check if message is a command
   */
  isCommand(message: Message): boolean {
    return message.body.startsWith(this.commandPrefix);
  }

  /**
   * Check if message is a number selection for pending PDDIKTI search
   */
  isPddiktiSelection(message: Message): boolean {
    const body = message.body.trim();
    if (!/^\d+$/.test(body)) return false;
    
    const session = this.pddiktiSessions.get(message.from);
    if (!session) return false;
    
    // Check if session expired
    if (Date.now() - session.timestamp > this.sessionTimeout) {
      this.pddiktiSessions.delete(message.from);
      return false;
    }
    
    return true;
  }

  /**
   * Handle command message
   */
  async handleCommand(message: Message): Promise<boolean> {
    if (!this.isCommand(message)) return false;

    const body = message.body.trim();
    const parts = body.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    this.logger.info('Processing command', { command, args, from: message.from });

    try {
      switch (command) {
        case '!pddikti':
          await this.handlePddiktiCommand(message, args);
          return true;
        case '!help':
          await this.handleHelpCommand(message);
          return true;
        default:
          return false;
      }
    } catch (error) {
      this.logger.error('Command execution failed', error as Error);
      await this.sendReply(message, '❌ Terjadi kesalahan saat memproses command');
      return true;
    }
  }

  /**
   * Handle number selection for PDDIKTI detail
   */
  async handlePddiktiSelection(message: Message): Promise<boolean> {
    const session = this.pddiktiSessions.get(message.from);
    if (!session) return false;

    const selection = parseInt(message.body.trim(), 10);
    
    if (selection < 1 || selection > Math.min(session.results.length, 10)) {
      await this.sendReply(message, `❌ Pilihan tidak valid. Masukkan angka 1-${Math.min(session.results.length, 10)}`);
      return true;
    }

    const selectedMhs = session.results[selection - 1];
    
    if (!selectedMhs.detailUrl) {
      await this.sendReply(message, '❌ Detail tidak tersedia untuk mahasiswa ini');
      this.pddiktiSessions.delete(message.from);
      return true;
    }

    await this.sendReply(message, `🔍 Mengambil detail *${selectedMhs.nama}*...`);

    try {
      const detail = await this.pddiktiScraper.getDetailMahasiswa(selectedMhs.detailUrl);
      
      if (detail) {
        const formattedDetail = this.pddiktiScraper.formatDetail(detail);
        await this.sendReply(message, formattedDetail);
      } else {
        await this.sendReply(message, '❌ Gagal mengambil detail mahasiswa');
      }
    } catch (error) {
      this.logger.error('Failed to get detail', error as Error);
      await this.sendReply(message, '❌ Gagal mengambil detail mahasiswa');
    }

    // Clear session after selection
    this.pddiktiSessions.delete(message.from);
    return true;
  }

  /**
   * Handle !pddikti command
   */
  private async handlePddiktiCommand(message: Message, args: string): Promise<void> {
    if (!args || args.trim().length === 0) {
      await this.sendReply(
        message,
        '❌ Format salah!\n\n' +
        '*Penggunaan:* !pddikti <nama mahasiswa>\n' +
        '*Contoh:* !pddikti muchtar ali anwar'
      );
      return;
    }

    const searchQuery = args.trim();
    await this.sendReply(message, `🔍 Mencari data mahasiswa "${searchQuery}"...`);

    try {
      const results = await this.pddiktiScraper.searchMahasiswa(searchQuery);
      
      if (results.length > 0) {
        // Store session for selection
        this.pddiktiSessions.set(message.from, {
          results,
          timestamp: Date.now(),
        });
      }
      
      const formattedResult = this.pddiktiScraper.formatResults(results, searchQuery);
      await this.sendReply(message, formattedResult);
    } catch (error) {
      this.logger.error('PDDIKTI search failed', error as Error);
      await this.sendReply(message, '❌ Gagal mengambil data dari PDDIKTI.\nSilakan coba lagi nanti.');
    }
  }

  /**
   * Handle !help command
   */
  private async handleHelpCommand(message: Message): Promise<void> {
    const helpMessage = 
      `📋 *Daftar Command*\n\n` +
      `*!pddikti <nama>*\n` +
      `   Cari data mahasiswa di PDDIKTI\n` +
      `   Contoh: !pddikti muchtar ali anwar\n` +
      `   Setelah hasil muncul, balas dengan angka untuk lihat detail\n\n` +
      `*!help*\n` +
      `   Tampilkan daftar command`;

    await this.sendReply(message, helpMessage);
  }

  /**
   * Send reply to message
   */
  private async sendReply(message: Message, text: string): Promise<void> {
    try {
      const client = this.clientManager.getClient();
      await client.sendMessage(message.from, text);
    } catch (error) {
      this.logger.error('Failed to send reply', error as Error);
    }
  }
}
