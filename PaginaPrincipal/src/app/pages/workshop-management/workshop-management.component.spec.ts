import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkshopManagementComponent } from './workshop-management.component';

describe('WorkshopManagementComponent', () => {
  let component: WorkshopManagementComponent;
  let fixture: ComponentFixture<WorkshopManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkshopManagementComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WorkshopManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
