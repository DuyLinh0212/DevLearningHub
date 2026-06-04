import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuizManagementComponent } from './quiz-management';
import { provideComponentTestDependencies } from '../../../testing/component-test.providers';

describe('QuizManagement', () => {
  let component: QuizManagementComponent;
  let fixture: ComponentFixture<QuizManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuizManagementComponent],
      providers: provideComponentTestDependencies()
    })
    .compileComponents();

    fixture = TestBed.createComponent(QuizManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
