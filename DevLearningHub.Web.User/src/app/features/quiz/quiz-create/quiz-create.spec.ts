import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuizCreateComponent } from './quiz-create';
import { provideComponentTestDependencies } from '../../../testing/component-test.providers';

describe('QuizCreate', () => {
  let component: QuizCreateComponent;
  let fixture: ComponentFixture<QuizCreateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuizCreateComponent],
      providers: provideComponentTestDependencies()
    })
    .compileComponents();

    fixture = TestBed.createComponent(QuizCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
