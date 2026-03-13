import { logger } from '@/lib/logger';

describe('logger', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('error', () => {
    it('always calls console.error', () => {
      logger.error('Something went wrong');
      expect(console.error).toHaveBeenCalledTimes(1);
    });

    it('includes the message in the output', () => {
      logger.error('Test error');
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Test error'));
    });

    it('accepts an optional error object without throwing', () => {
      expect(() => logger.error('fail', new Error('oops'))).not.toThrow();
    });

    it('accepts undefined as error without throwing', () => {
      expect(() => logger.error('fail', undefined)).not.toThrow();
    });
  });

  describe('sanitizedError', () => {
    it('does not throw for an Error instance', () => {
      expect(() => logger.sanitizedError('Context', new Error('detail'))).not.toThrow();
    });

    it('does not throw for a non-Error value', () => {
      expect(() => logger.sanitizedError('Context', 'string error')).not.toThrow();
    });

    it('does not throw for null', () => {
      expect(() => logger.sanitizedError('Context', null)).not.toThrow();
    });

    it('calls console.error', () => {
      logger.sanitizedError('msg', new Error('e'));
      expect(console.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('info and warn (production guard)', () => {
    it('info does not throw', () => {
      expect(() => logger.info('info message')).not.toThrow();
    });
    it('warn does not throw', () => {
      expect(() => logger.warn('warn message')).not.toThrow();
    });
  });
});
