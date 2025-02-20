import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SecurityAccessControlComponent } from './security-access-control.component';

describe('SecurityAccessControlComponent', () => {
  let component: SecurityAccessControlComponent;
  let fixture: ComponentFixture<SecurityAccessControlComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SecurityAccessControlComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SecurityAccessControlComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
