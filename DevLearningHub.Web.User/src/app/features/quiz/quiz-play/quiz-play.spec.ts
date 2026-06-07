import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { QuizPlayComponent } from './quiz-play';
import { QuizService } from '../../../core/services/quiz.service';
import { provideComponentTestDependencies } from '../../../testing/component-test.providers';

describe('QuizPlay', () => {
  let component: QuizPlayComponent;
  let fixture: ComponentFixture<QuizPlayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuizPlayComponent],
      providers: [
        ...provideComponentTestDependencies(),
        {
          provide: QuizService,
          useValue: {
            startQuizSession: jasmine.createSpy('startQuizSession').and.returnValue(of({
              data: {
                sessionId: 'session-1',
                quizSetId: '1',
                title: 'Sample Quiz',
                timeLimitSeconds: 900,
                totalQuestions: 1,
                questions: [
                  {
                    questionId: 'question-1',
                    content: 'Sample question?',
                    level: 'Easy',
                    options: [
                      { id: 'option-1', content: 'A', orderIndex: 0 },
                      { id: 'option-2', content: 'B', orderIndex: 1 }
                    ]
                  }
                ]
              }
            })),
            submitQuizSession: jasmine.createSpy('submitQuizSession').and.returnValue(of({ data: {} }))
          }
        }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QuizPlayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
