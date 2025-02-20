import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkshopRequestComponent } from './workshop-request.component';

describe('WorkshopRequestComponent', () => {
  let component: WorkshopRequestComponent;
  let fixture: ComponentFixture<WorkshopRequestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkshopRequestComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WorkshopRequestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
