import { NgModule } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { AvatarModule } from 'primeng/avatar';
import { TooltipModule } from 'primeng/tooltip';
import { TextareaModule } from 'primeng/textarea';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';



@NgModule({
  declarations: [],
  imports: [
    DecimalPipe
  ],
  exports: [
    CommonModule,
    ButtonModule,
    FormsModule,
    SelectModule,
    InputTextModule,
    InputNumberModule,
    DatePickerModule,
    CheckboxModule,
    InputGroupModule,
    InputGroupAddonModule,
    DialogModule,
    TableModule,
    DecimalPipe,
    BadgeModule,
    AvatarModule,
    TooltipModule,
    TextareaModule,
    ConfirmDialogModule,
    ToastModule
  ]
})
export class SharedModules { }
