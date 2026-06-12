import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuizBankComponent } from './quiz-bank';
import { provideComponentTestDependencies } from '../../../testing/component-test.providers';

describe('QuizBank', () => {
  let component: QuizBankComponent;
  let fixture: ComponentFixture<QuizBankComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuizBankComponent],
      providers: provideComponentTestDependencies()
    })
    .compileComponents();

    fixture = TestBed.createComponent(QuizBankComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
