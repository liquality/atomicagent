const expect = require('chai').expect
const { buildConnectUri } = require('../../../src/utils/mongoConnect')

describe('UTIL: mongoConnect', () => {
  describe('buildConnectUri', () => {
    it('should throw an error when a host is not provided', () => {
      const emptyOpts = {}

      expect(() => { buildConnectUri(emptyOpts) }).to.throw()
    })

    it('should throw an error when provided an imcomplete username and password pair', () => {
      const userNoPassword = {
        host: 'localhost',
        username: 'admin',
        password: ''
      }

      const passwordNoUser = {
        host: 'localhost',
        username: '',
        password: 'myPassw0rd'
      }

      expect(() => { buildConnectUri(userNoPassword) }).to.throw('A db username was provided, but no password')
      expect(() => { buildConnectUri(passwordNoUser) }).to.throw('A db password was provided, but no username')
    })

    it('should build a valid uri from minimum options (a host)', () => {
      const minOpts = {
        host: 'localhost'
      }

      // mongodb://localhost
      expect(buildConnectUri(minOpts)).to.equal(`mongodb://${minOpts.host}`)
    })

    it('should support an explicitly provided port', () => {
      const opts = {
        host: 'localhost',
        port: '12358',
        username: 'root',
        password: 'password'
      }

      // mongodb://root:password@localhost:12358
      expect(buildConnectUri(opts)).to.equal(`mongodb://${opts.username}:${opts.password}@${opts.host}:${opts.port}`)
    })

    it('should support a provided database name', () => {
      const withPort = {
        host: 'localhost',
        port: '12358',
        username: 'root',
        password: 'password',
        dbname: 'liquality-test'
      }

      const noPort = {
        host: 'localhost',
        username: 'root',
        password: 'password',
        dbname: 'liquality-test'
      }

      // mongodb://root:password@localhost:12358/liquality-test
      expect(buildConnectUri(withPort)).to.equal(`mongodb://${withPort.username}:${withPort.password}@${withPort.host}:${withPort.port}/${withPort.dbname}`)
      // mongodb://root:password@localhost/liquality-test
      expect(buildConnectUri(noPort)).to.equal(`mongodb://${noPort.username}:${noPort.password}@${noPort.host}/${noPort.dbname}`)
    })

    it('should support auth using the default auth db', () => {
      const opts = {
        host: 'localhost',
        username: 'root',
        password: 'password'
      }

      // mongodb://root:password@localhost
      expect(buildConnectUri(opts)).to.equal(`mongodb://${opts.username}:${opts.password}@${opts.host}`)
    })

    it('should support auth with a provided auth db', () => {
      const opts = {
        host: 'localhost',
        username: 'root',
        password: 'password',
        authdbname: 'user'
      }

      // mongodb://root:password@localhost?authSource=user
      expect(buildConnectUri(opts)).to.equal(`mongodb://${opts.username}:${opts.password}@${opts.host}?authSource=${opts.authdbname}`)
    })

    it('should support the full set of options', () => {
      const opts = {
        host: '10.0.1.200',
        port: '28000',
        username: 'Administrator',
        password: 'my-password',
        dbname: 'liquality-test-db',
        authdbname: 'test_me'
      }

      // mongodb://Administrator:my-password@10.0.1.200:28000/liquality-test-db?authSource=test_me
      expect(buildConnectUri(opts)).to.equal(`mongodb://${opts.username}:${opts.password}@${opts.host}:${opts.port}/${opts.dbname}?authSource=${opts.authdbname}`)
    })
  }) // END - buildConnectUri
})
