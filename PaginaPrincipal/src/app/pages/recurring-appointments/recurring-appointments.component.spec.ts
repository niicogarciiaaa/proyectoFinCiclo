import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecurringAppointmentsComponent } from './recurring-appointments.component';

describe('RecurringAppointmentsComponent', () => {
  let component: RecurringAppointmentsComponent;
  let fixture: ComponentFixture<RecurringAppointmentsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecurringAppointmentsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecurringAppointmentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
