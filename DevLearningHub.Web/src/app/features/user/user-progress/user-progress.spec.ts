import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserProgress } from './user-progress';

describe('UserProgress', () => {
  let component: UserProgress;
  let fixture: ComponentFixture<UserProgress>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserProgress]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserProgress);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
