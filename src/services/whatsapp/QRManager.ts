/**
 * File: QR Code Manager
 * Description: Handles QR code generation and WebSocket broadcasting
 * Path: ./src/services/whatsapp/QRManager.ts
 */

import QRCode from 'qrcode';
import logger from '../../utils/logger';

class QRManager {
  async generateQRCodeDataURL(qrString: string): Promise<string> {
    try {
      const qrDataURL = await QRCode.toDataURL(qrString, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 300,
        margin: 1,
      });

      return qrDataURL;
    } catch (error) {
      logger.error('Error generating QR code', error);
      throw new Error('Failed to generate QR code');
    }
  }

  async generateQRCodeBuffer(qrString: string): Promise<Buffer> {
    try {
      const buffer = await QRCode.toBuffer(qrString, {
        errorCorrectionLevel: 'H',
        type: 'png',
        width: 300,
        margin: 1,
      });

      return buffer;
    } catch (error) {
      logger.error('Error generating QR code buffer', error);
      throw new Error('Failed to generate QR code buffer');
    }
  }

  async generateQRCodeSVG(qrString: string): Promise<string> {
    try {
      const svg = await QRCode.toString(qrString, {
        type: 'svg',
        errorCorrectionLevel: 'H',
      });

      return svg;
    } catch (error) {
      logger.error('Error generating QR code SVG', error);
      throw new Error('Failed to generate QR code SVG');
    }
  }
}

export default new QRManager();
