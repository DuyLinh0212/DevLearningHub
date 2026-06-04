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
            getQuiz: jasmine.createSpy('getQuiz').and.returnValue(of({
              id: '1',
              title: 'Sample Quiz',
              duration: 15,
              shuffle: false,
              instantResult: true,
              questions: [
                {
                  id: 1,
                  points: 10,
                  level: 'Easy',
                  text: 'Sample question?',
                  options: ['A', 'B', 'C', 'D'],
                  correctIndex: 0
                }
              ]
            })),
            incrementAttempts: jasmine.createSpy('incrementAttempts'),
            saveResults: jasmine.createSpy('saveResults')
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
