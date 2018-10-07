import { BrowserModule } from '@angular/platform-browser'
import { NgModule } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { AppComponent } from './app.component'
import { SupplyChainComponent } from './supply-chain/supply-chain.component'
import { GroupWorkSummaryComponent } from './supply-chain/group-work-summary.component'
import { State } from './supply-chain/state'

@NgModule({
  declarations: [
    AppComponent,
    SupplyChainComponent,
    GroupWorkSummaryComponent
  ],
  imports: [
    BrowserModule,
    FormsModule
  ],
  providers: [
    State
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
