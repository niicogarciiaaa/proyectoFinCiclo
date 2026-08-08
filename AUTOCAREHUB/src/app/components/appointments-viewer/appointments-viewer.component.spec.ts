import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppointmentsViewerComponent } from './appointments-viewer.component';

describe('AppointmentsViewerComponent', () => {
  let component: AppointmentsViewerComponent;
  let fixture: ComponentFixture<AppointmentsViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppointmentsViewerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AppointmentsViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
