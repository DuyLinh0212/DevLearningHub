import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuizBank } from './quiz-bank';

describe('QuizBank', () => {
  let component: QuizBank;
  let fixture: ComponentFixture<QuizBank>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuizBank]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QuizBank);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
