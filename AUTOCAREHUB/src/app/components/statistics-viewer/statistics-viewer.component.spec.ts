import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StatisticsViewerComponent } from './statistics-viewer.component';

describe('StatisticsViewerComponent', () => {
  let component: StatisticsViewerComponent;
  let fixture: ComponentFixture<StatisticsViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatisticsViewerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StatisticsViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
