import os from 'node:os';

export class SystemResourceHelper {
  public static getStats() {
    const memoryUsage = process.memoryUsage();

    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    const cpus = os.cpus();
    const loadAvg = os.loadavg();

    return {
      process: {
        ram: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        uptime: `${(process.uptime() / 60).toFixed(2)} minutos`,
      },
      system: {
        cpuModel: cpus[0]?.model,
        cpuUsage: `${((loadAvg[0] || 0 * 100) / cpus.length).toFixed(1)}%`,
        ramTotal: `${(totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
        ramUsed: `${(usedMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
        platform: os.platform(),
      },
    };
  }

  getProcessRAM() {
    const memoryUsage = process.memoryUsage();
    return `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`;
  }
}
