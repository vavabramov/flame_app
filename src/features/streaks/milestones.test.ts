import { milestoneProgress } from './milestones';

describe('milestones', () => {
  it('starts with the first milestone ahead', () => {
    expect(milestoneProgress(0)).toEqual({ reached: [], next: 7, remaining: 7 });
  });

  it('reaches a milestone exactly at its count', () => {
    expect(milestoneProgress(7)).toEqual({ reached: [7], next: 14, remaining: 7 });
    expect(milestoneProgress(29)).toEqual({ reached: [7, 14], next: 30, remaining: 1 });
  });

  it('has nothing left after the last one', () => {
    expect(milestoneProgress(250)).toEqual({ reached: [7, 14, 30, 100], next: null, remaining: 0 });
  });
});
