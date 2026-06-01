import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuizManagement } from './quiz-management';

describe('QuizManagement', () => {
  let component: QuizManagement;
  let fixture: ComponentFixture<QuizManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuizManagement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QuizManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
