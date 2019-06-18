<template>
  <div id="app">
    <nav class="navbar navbar-expand-lg navbar-light">
      <div class="container">
        <router-link class="navbar-brand" to="/">💥 Atomic Agent</router-link>
        <div class="collapse navbar-collapse" id="navbarSupportedContent">
          <ul class="navbar-nav ml-auto">
            <li class="nav-item">
              <a href="https://cross-chain-playground.hv.pizza/" class="nav-link" target="_blank" rel="noopener">Library</a>
            </li>
          </ul>
        </div>
      </div>
    </nav>
    <router-view class="container mt-4 mb-5" />
  </div>
</template>

<style lang="scss">
#app {
  border-top: 3px solid $primary;
}
</style>
