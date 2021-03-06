// @flow

const neo4j = require("neo4j-driver");

/**
 * Transforms a date t seconds epoch.
 * @param  {Date} date The date to be converted.
 * @return {Integer}      Representation of the date in seconds epoch.
 */
export function toSecondsEpoch(date: Date): number {
    if (!(date instanceof Date)) {
      throw new Error(`${date} is not a Date!`);
    }
    return Math.floor(date.getTime() / 1000);
  }
  
export function fromSecondsEpoch(dateAsSeconds : number): Date {
    var date = new Date(dateAsSeconds*1000);
    
    if (!(date instanceof Date)) {
      throw new Error(`${dateAsSeconds} not convertible to a Date!`);
    }
    return date;
  }

  /**
   * Logs messages when debug is enabled.
   * @param  {String} message Message to be debugged.
   * @param  {Object} object  Optional param that will be stringified.
   */
  export function debug(message: string, object: ?Object): void {
    if (process.env.NEO4JSESSIONSTORE_DEBUG) {
      const argument = object || '';
  
      console.log(
        `${new Date().toString()} - NEO4JSESSIONSTORE: ${message}`,
        typeof argument === 'object' ? JSON.stringify(argument) : argument,
      );
    }
  }
  
  /**
   * Checks if an expiration date has passed.
   * @param {number} expiresOn Optional expiration date on second epoch.
   */
  export function isExpired(expiresOn: ?number): boolean {
    return !expiresOn || expiresOn <= toSecondsEpoch(new Date());
  }
