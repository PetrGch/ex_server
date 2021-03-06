import { scrapersConfig } from "../../scriper/scrapersConfig"
import {updateCurrenciesAmount} from "./exchangeCurrencyService";
import {telegramLogger} from "../bot/telegramServerBot";

export async function scrapeCompanyInParallel() {
  const errors = [];
  telegramLogger("New scraping iteration have began");

  for (let i = 0; i < scrapersConfig.length; i++) {
    try {
      const scrapedCompany = await scrapersConfig[i].scrape();
      if (scrapedCompany === null) {
        telegramLogger(`Company ${scrapersConfig[i].name} is null`);
      } else {
        await updateCurrenciesAmount(scrapedCompany);
        telegramLogger(`Company ${scrapersConfig[i].name} was successfully updated`);
      }
    } catch (ex) {
      errors.push(ex.message);
      telegramLogger(`Company ${scrapersConfig[i].name} was unsuccessfully parsed! ${ex.message}`)
    }
  }

  if (errors.length !== 0 && errors.length !== scrapersConfig.length) {
    return Promise.rejects("Company was parsed partially");
  } else if (errors.length !== 0) {
    return Promise.rejects("Fail!");
  }
  return Promise.resolve("Success!");
}

export const scraperCompanySingleton = (function () {
  let isSchedulerRunning;
  let statistic;
  let intervalId;

  function createStatistic() {
    statistic = {
      amountOfUpdates: 0,
      successUpdates: 0,
      failUpdates: 0
    };
  }

  function scrape() {
    scrapeCompanyInParallel()
      .then(() => {
        if (statistic) {
          statistic.amountOfUpdates += 1;
          statistic.successUpdates += 1;
        }
      }, () => {
        if (statistic) {
          statistic.failUpdates += 1;
        }
      });
  }

  function run(interval = 1200000) {
    isSchedulerRunning = true;
    scrape();

    intervalId = setTimeout(function tick() {
      scrape();
      intervalId = setTimeout(tick, interval);
    }, interval);
  }

  function stop() {
    if (isSchedulerRunning) {
      clearTimeout(intervalId);
      isSchedulerRunning = false;
    }
  }

  return {
    run: function(interval) {
      if (!statistic) {
        createStatistic();
      }
      if (isSchedulerRunning) {
        return "Scheduler already is running";
      }

      run(interval);
      return `Scheduler is running with interval: ${interval}ms`
    },
    restart: function(interval) {
      if (!statistic) {
        createStatistic();
      }
      if (isSchedulerRunning) {
        stop();
        run(interval);

        return statistic;
      }

      return "Scheduler wasn't started yet";
    },
    stop: function() {
      if (!isSchedulerRunning) {
        return "Scheduler wasn't started yet";
      }
      stop();
      return "Scheduler was stopped";
    },
    statistic: function () {
      return statistic;
    }
  };
})();