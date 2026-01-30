class Scheduler {
  constructor(db, downloadManager) {
    this.db = db;
    this.downloadManager = downloadManager;
    this.intervals = new Map();
    this.globalInterval = null;
  }

  start(intervalDays = 7) {
    if (this.globalInterval) {
      clearInterval(this.globalInterval);
    }

    // Convert days to milliseconds
    const intervalMs = intervalDays * 24 * 60 * 60 * 1000;

    console.log(`Starting scheduler with ${intervalDays} day interval`);

    // Run immediately on start
    this.checkAndDownload();

    // Schedule recurring checks
    this.globalInterval = setInterval(() => {
      this.checkAndDownload();
    }, intervalMs);
  }

  stop() {
    if (this.globalInterval) {
      clearInterval(this.globalInterval);
      this.globalInterval = null;
    }
  }

  async checkAndDownload() {
    console.log('Scheduler: Checking for new content...');
    
    const channels = this.db.getAllChannels();
    const now = Math.floor(Date.now() / 1000);

    for (const channel of channels) {
      const shouldRescrape = !channel.last_scraped_at || 
        (now - channel.last_scraped_at) >= (channel.rescrape_interval_days * 24 * 60 * 60);

      if (shouldRescrape) {
        console.log(`Scheduler: Processing channel ${channel.id} - ${channel.channel_name || channel.url}`);
        
        try {
          // Download from channel
          await this.downloadManager.downloadChannel(channel.id);
        } catch (err) {
          console.error(`Scheduler: Failed to process channel ${channel.id}:`, err.message);
        }
      }
    }
  }

  async triggerChannel(channelId) {
    console.log(`Manually triggering channel ${channelId}`);
    await this.downloadManager.downloadChannel(channelId);
  }

  getStatus() {
    return {
      running: this.globalInterval !== null,
      queueStatus: this.downloadManager.getQueueStatus()
    };
  }
}

module.exports = Scheduler;
