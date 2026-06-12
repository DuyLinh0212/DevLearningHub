import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideComponentTestDependencies } from '../../../testing/component-test.providers';
import { UserProgressComponent } from './user-progress';

describe('UserProgress', () => {
  let component: UserProgressComponent;
  let fixture: ComponentFixture<UserProgressComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserProgressComponent],
      providers: provideComponentTestDependencies()
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserProgressComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
