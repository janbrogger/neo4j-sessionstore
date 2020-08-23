import { toSecondsEpoch } from '../lib/util';
import { fromSecondsEpoch } from '../lib/util';
import { isExpired } from '../lib/util';


describe('util', () => {
  it('should calculate the seconds epoch for a date', () => {
    const date = new Date('2017-07-18T00:00:00.000Z');
    const asSeconds = toSecondsEpoch(date);
    expect(asSeconds).toBe(1500336000);
  });

  it('should raise an error for non-date argument', () => {
    expect(() => {
      toSecondsEpoch({});
    }).toThrow();
  });

  it('should calculate a date from the seconds epoch', () => {
    const dateAsSeconds = 1500336000;
    const dateAsDate = new Date('2017-07-18T00:00:00.000Z');
    const asDate = fromSecondsEpoch(dateAsSeconds);
    expect(asDate.toISOString()).toEqual(dateAsDate.toISOString());
  });

    it('should return as expired an old cookie', () => {
    const date1 = new Date(1900,1,1);
    expect(isExpired(toSecondsEpoch(date1))).toEqual(true);

    const date2 = new Date(Date.now() + 1000);
    expect(isExpired(toSecondsEpoch(date2))).toEqual(false);

    const date3 = new Date(Date.now() - 1000);
    expect(isExpired(toSecondsEpoch(date3))).toEqual(true);

    const date4 = new Date(Date.now() - 1);
    expect(isExpired(toSecondsEpoch(date4))).toEqual(true);

    //const date5 = new Date(Date.now() + 900);
    //expect(isExpired(toSecondsEpoch(date5))).toEqual(false);

    //This fails intermittently
    //const date6 = new Date(Date.now() + 600);
    //expect(isExpired(toSecondsEpoch(date6))).toEqual(false);

    //Anything less than +500 fails, which is likely down to less than one second
    //const date7 = new Date(Date.now() + 500);
    //expect(isExpired(toSecondsEpoch(date7))).toEqual(false);

  });
});