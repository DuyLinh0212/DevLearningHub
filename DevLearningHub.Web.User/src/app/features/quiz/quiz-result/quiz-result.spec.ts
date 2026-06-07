import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuizResultComponent } from './quiz-result';
import { provideComponentTestDependencies } from '../../../testing/component-test.providers';

describe('QuizResult', () => {
  let component: QuizResultComponent;
  let fixture: ComponentFixture<QuizResultComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuizResultComponent],
      providers: provideComponentTestDependencies()
    })
    .compileComponents();

    fixture = TestBed.createComponent(QuizResultComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
